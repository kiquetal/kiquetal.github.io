---
title:
  en: 'Fine-Grained Tenant Isolation with Istio External Authorization'
  es: 'Aislamiento de inquilinos de grano fino con Istio External Authorization'
excerpt:
  en: 'Learn how to offload path-level tenant validation and resource ownership verification to the Service Mesh using Istios CUSTOM authorization and an external authorizer.'
  es: 'Aprende cómo delegar la validación de multi-tenancy y la verificación de propiedad de recursos al Service Mesh utilizando la autorización CUSTOM de Istio y un autorizador externo.'
date: 2026-07-26T12:00:00Z
tags: ['istio', 'security', 'k8s', 'authorization']
draft: true
---

<div class="lang-en">

## The Challenge of Path-Level Multi-Tenancy

Validating a JSON Web Token (JWT) signature at your API Gateway is standard practice. If the cryptographic signature matches, the token is trusted. However, authentication (who you are) is only half the battle. **Fine-grained authorization (what you are allowed to access)** is where the real security engineering begins.

Consider an endpoint like `/BR/accounts/{msisdn}/balance`.
* **The Vulnerability**: A malicious user authenticated with a valid JWT under `msisdn: "5511999990000"` might try to query `/BR/accounts/5511888880000/balance`.
* **The Cause**: The JWT signature is valid, so a basic API gateway lets the request pass. The microservice backend must now write boilerplate code to decode the JWT, parse the path parameter, and manually check if the user actually owns that account.

Writing resource ownership validation across dozens of services leads to code duplication, inconsistent security checks, and vulnerable endpoints if a developer forgets to write the verification loop.

Offloading this path-level tenant validation to **Istio's CUSTOM External Authorization (`ext_authz`)** allows you to secure your entire service mesh at the network layer, completely decoupled from your business logic.

---

## The Architecture: Zero-Lua KrakenD + Istio Inbound Interception

Our production-grade design utilizes two layers of interception:

1. **KrakenD (API Gateway)**: Acts as the entry router. Rather than performing heavy auth calculations, it simply routes the request and injects a logical target service name header:
   ```json
   "headers_to_add": {
     "X-Target-Service": "account-service"
   }
   ```
2. **Istio Envoy Sidecar (Target Pod)**: Intercepts inbound traffic entering the `account-service` pod. Envoy freezes the connection and delegates the path-aware validation payload to `middleware-nomos` (the validation engine).

```
Client ──► [KrakenD Gateway] (Stamps X-Target-Service: account-service)
                  │
                  ▼
         [account-service Pod]
                  │
                  ▼  (Inbound network interception)
         [Envoy Sidecar Proxy] ──► [middleware-nomos] (External Authorizer)
                  │                       │
                  │                       ├──► Fetches rules from Nomos API (and caches)
                  │                       ├──► Decodes JWT claims
                  │                       ├──► Matches path parameters against Rule Pattern
                  │                       ├──► Evaluates Level 1 & Level 2 check logic
                  │                       └──► Calls Enrichment fallback API if triggered
                  │
                  ├─── [If ALLOWED: 200 OK] ───► [account-service container]
                  └─── [If DENIED:  403 Error] ──► (Short-circuits directly back to client)
```

---

## Step 1: Register the Authorizer in Istio

First, we define our external authorizer service (`middleware-nomos`) in Istio’s global `meshConfig`. Under your ConfigMap `istio` (usually in `istio-system`):

```yaml
data:
  mesh: |-
    extensionProviders:
    - name: "middleware-nomos-provider"
      httpService:
        service: "middleware-nomos.default.svc.cluster.local"
        port: "8080"
        pathPrefix: "/check"
        # Forward custom and security headers to our authorizer
        includeRequestHeadersInCheck:
        - "x-target-service"
        - "authorization"
        - "x-original-method"
```

---

## Step 2: Create the CUSTOM AuthorizationPolicy

Next, create an `AuthorizationPolicy` with the `CUSTOM` action. This policy targets our microservice pod and forces its Envoy sidecar to execute inbound interception:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: ext-auth-by-nomos
  namespace: default
spec:
  selector:
    matchLabels:
      app: account-service
  action: CUSTOM
  provider:
    name: "middleware-nomos-provider"
  rules:
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/*"]
```

---

## Step 3: Implementing the "Hard Job" inside the Middleware

The `middleware-nomos` is the component that performs the resource-ownership calculations. It implements the following security flow:

1. **Rule Discovery**: Fetches active rules from the central Nomos database based on the target proxy and audience (e.g. `GET /api/v1/rules?proxy=account-service&aud=client_id_123`). This schema contract is cached locally in memory for high performance.
2. **Level 1 (Fail-Early Check)**: Extracts country or region variables from the URL path and verifies they exactly match the JWT tenant claims. If they do not match, it returns an immediate `403 Forbidden`, blocking malicious cross-region lateral movement.
3. **Level 2 (Deep Validation & Enrichment)**: Parses the resource identifiers (e.g., `{msisdn}`). If the user's JWT has incomplete claims, it performs a secure, cached HTTP enrichment lookup (e.g. calling `{jwtIssuer}/users/me`) to fetch allowed resource lists. If ownership validation fails, access is denied.

Here is a look at the core Express evaluation handler:

```javascript
app.post('/check', async (req, res) => {
  const targetService = req.headers['x-target-service'];
  const authHeader = req.headers['authorization'];
  const originalPath = req.headers['x-original-path'] || req.path;

  // 1. Decode JWT and query local cache for rule definitions
  const token = authHeader.split(' ')[1];
  const decodedJwt = jwtDecode(token);
  const rules = await fetchRulesForProxyAndAud(targetService, decodedJwt.aud);

  // 2. Find matching rule path template (e.g. /{country}/accounts/{msisdn}/balance)
  const matchedRule = findMatchingRule(rules, originalPath);
  const pathParams = extractParams(matchedRule.pathPattern, originalPath);

  // 3. Level 1 (Country/IP boundary checking)
  for (const val of matchedRule.validations.filter(v => v.level === 1)) {
    const claimVal = queryClaim(decodedJwt, val.jwtJsonPath);
    if (pathParams[val.paramName] !== claimVal) {
       return res.status(403).json({ error: "L1_COUNTRY_MISMATCH" });
    }
  }

  // 4. Level 2 (Resource ownership & optional API enrichment fallback)
  for (const val of matchedRule.validations.filter(v => v.level === 2)) {
    let claimVal = queryClaim(decodedJwt, val.jwtJsonPath);
    if (val.enrichment && needsEnrichment(decodedJwt, val.enrichment)) {
      claimVal = await performCachedEnrichment(token, val.enrichment);
    }
    if (!verifyOwnership(val.validation, pathParams[val.paramName], claimVal)) {
       return res.status(403).json({ error: "L2_OWNERSHIP_VERIFICATION_FAILED" });
    }
  }

  // 5. Success -> Return 200 OK to let Envoy route traffic
  return res.status(200).send("OK");
});
```

---

## Step 4: SPIFFE Auditing and Telemetry

When an authorization check fails, logging the incident with high-fidelity network contexts is crucial. 

By default, Istio injects **SPIFFE identities** (Secure Production Identity Framework for Everyone) inside the `X-Forwarded-Client-Cert` (XFCC) header of internal requests. Your middleware should capture this telemetry:

* **Audit Tracing**: Log the source service's SPIFFE ID (e.g., `spiffe://cluster.local/ns/default/sa/krakend-sa`), the client IP, the failed JWT tenant details, and the attempted target resource path.
* **Alerting**: Forward access violations directly to your Security Information and Event Management (SIEM) pipeline. Because the middleware sits at the mesh edge, you can detect, alert, and flag tenant violation attempts instantly, long before they can probe backend database nodes.

---

## Conclusion

*(Check out our visual architecture overview and step-by-step verification diagram below!)*

![Istio External Authorization Sequence](/blog/2026-07-26-istio-external-authorization/architecture.png)

![Istio Path-Based JWT Verification Diagram](/blog/2026-07-26-istio-external-authorization/istio_ext_authz_diagram-en.png)

</div>

<div class="lang-es hidden">

## El desafío del aislamiento de inquilinos a nivel de ruta

Validar la firma de un JSON Web Token (JWT) en tu API Gateway es una práctica estándar. Si la firma criptográfica coincide, el token es confiable. Sin embargo, la autenticación (quién eres) es solo la mitad de la batalla. **La autorización de grano fino (a qué tienes permitido acceder)** es donde comienza la verdadera ingeniería de seguridad.

Considera un endpoint como `/BR/accounts/{msisdn}/balance`.
* **La vulnerabilidad**: Un usuario malintencionado autenticado con un JWT válido bajo el `msisdn: "5511999990000"` podría intentar consultar `/BR/accounts/5511888880000/balance`.
* **La causa**: La firma del JWT es válida, por lo que una puerta de enlace de API básica deja pasar la solicitud. El microservicio backend ahora debe escribir código repetitivo para decodificar el JWT, analizar el parámetro de ruta y verificar manualmente si el usuario realmente es el dueño de esa cuenta.

Escribir la validación de propiedad de recursos en docenas de servicios genera duplicación de código, controles de seguridad inconsistentes y endpoints vulnerables si un desarrollador olvida escribir el ciclo de verificación.

Delegar esta validación de inquilino a nivel de ruta a la **Autorización Externa CUSTOM de Istio (`ext_authz`)** te permite asegurar todo tu service mesh en la capa de red, completamente desacoplado de tu lógica de negocio.

---

## La arquitectura: KrakenD sin Lua + Intercepción Inbound de Istio

Nuestro diseño de nivel de producción utiliza dos capas de intercepción:

1. **KrakenD (API Gateway)**: Actúa como el enrutador de entrada. En lugar de realizar cálculos pesados de autenticación, simplemente enruta la solicitud e inyecta un encabezado con el nombre lógico del servicio destino:
   ```json
   "headers_to_add": {
     "X-Target-Service": "account-service"
   }
   ```
2. **Istio Envoy Sidecar (Pod de destino)**: Intercepta el tráfico entrante que ingresa al pod `account-service`. Envoy congela la conexión y delega el payload de validación consciente de la ruta a `middleware-nomos` (el motor de validación).

```
Client ──► [KrakenD Gateway] (Inserta X-Target-Service: account-service)
                  │
                  ▼
         [account-service Pod]
                  │
                  ▼  (Intercepción de red inbound)
         [Envoy Sidecar Proxy] ──► [middleware-nomos] (Autorizador Externo)
                  │                       │
                  │                       ├──► Obtiene reglas de la API de Nomos (con caché)
                  │                       ├──► Decodifica los claims del JWT
                  │                       ├──► Compara los parámetros de la ruta con la regla
                  │                       ├──► Evalúa la lógica de verificación de Nivel 1 y Nivel 2
                  │                       └──► Llama a la API de enriquecimiento si se activa
                  │
                  ├─── [Si es PERMITIDO: 200 OK] ───► [contenedor account-service]
                  └─── [Si es DENEGADO:  403 Error] ──► (Corta el flujo directo al cliente)
```

---

## Paso 1: Registrar el autorizador en Istio

Primero, definimos nuestro servicio de autorizador externo (`middleware-nomos`) en el `meshConfig` global de Istio. Dentro de tu ConfigMap `istio` (generalmente en `istio-system`):

```yaml
data:
  mesh: |-
    extensionProviders:
    - name: "middleware-nomos-provider"
      httpService:
        service: "middleware-nomos.default.svc.cluster.local"
        port: "8080"
        pathPrefix: "/check"
        # Reenvía encabezados personalizados y de seguridad a nuestro autorizador
        includeRequestHeadersInCheck:
        - "x-target-service"
        - "authorization"
        - "x-original-method"
```

---

## Paso 2: Crear la política de autorización CUSTOM

A continuación, crea una política `AuthorizationPolicy` con la acción `CUSTOM`. Esta política apunta a nuestro pod de microservicio y obliga a su sidecar Envoy a ejecutar la intercepción inbound:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: ext-auth-by-nomos
  namespace: default
spec:
  selector:
    matchLabels:
      app: account-service
  action: CUSTOM
  provider:
    name: "middleware-nomos-provider"
  rules:
  - to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/*"]
```

---

## Paso 3: Implementar el "trabajo difícil" dentro del middleware

El `middleware-nomos` es el componente que realiza los cálculos de propiedad del recurso. Implementa el siguiente flujo de seguridad:

1. **Descubrimiento de reglas**: Obtiene las reglas activas de la base de datos central de Nomos según el proxy destino y el audience (por ejemplo, `GET /api/v1/rules?proxy=account-service&aud=client_id_123`). Este contrato de esquema se almacena localmente en memoria para un alto rendimiento.
2. **Nivel 1 (Validación de fail-early)**: Extrae las variables de país o región de la ruta URL y verifica que coincidan exactamente con los claims de inquilino del JWT. Si no coinciden, devuelve un `403 Forbidden` inmediato, bloqueando cualquier movimiento lateral malicioso entre regiones.
3. **Nivel 2 (Validación profunda y enriquecimiento)**: Analiza los identificadores de recursos (por ejemplo, `{msisdn}`). Si el JWT del usuario tiene claims incompletos, realiza una búsqueda de enriquecimiento HTTP segura y almacenada en caché (por ejemplo, llamando a `{jwtIssuer}/users/me`) para recuperar la lista de recursos permitidos. Si la validación de propiedad falla, se deniega el acceso.

Aquí un vistazo al manejador principal de evaluación en Express:

```javascript
app.post('/check', async (req, res) => {
  const targetService = req.headers['x-target-service'];
  const authHeader = req.headers['authorization'];
  const originalPath = req.headers['x-original-path'] || req.path;

  // 1. Decodifica el JWT y consulta la caché local para obtener las reglas
  const token = authHeader.split(' ')[1];
  const decodedJwt = jwtDecode(token);
  const rules = await fetchRulesForProxyAndAud(targetService, decodedJwt.aud);

  // 2. Encuentra la regla que coincida con el path (ej. /{country}/accounts/{msisdn}/balance)
  const matchedRule = findMatchingRule(rules, originalPath);
  const pathParams = extractParams(matchedRule.pathPattern, originalPath);

  // 3. Nivel 1 (Control de límites de País/IP)
  for (const val of matchedRule.validations.filter(v => v.level === 1)) {
    const claimVal = queryClaim(decodedJwt, val.jwtJsonPath);
    if (pathParams[val.paramName] !== claimVal) {
       return res.status(403).json({ error: "L1_COUNTRY_MISMATCH" });
    }
  }

  // 4. Nivel 2 (Verificación de propiedad con opción de enriquecimiento por API externa)
  for (const val of matchedRule.validations.filter(v => v.level === 2)) {
    let claimVal = queryClaim(decodedJwt, val.jwtJsonPath);
    if (val.enrichment && needsEnrichment(decodedJwt, val.enrichment)) {
      claimVal = await performCachedEnrichment(token, val.enrichment);
    }
    if (!verifyOwnership(val.validation, pathParams[val.paramName], claimVal)) {
       return res.status(403).json({ error: "L2_OWNERSHIP_VERIFICATION_FAILED" });
    }
  }

  // 5. Éxito -> Retorna 200 OK para que Envoy enrute la solicitud
  return res.status(200).send("OK");
});
```

---

## Paso 4: Auditoría SPIFFE y Telemetría

Cuando falla una verificación de autorización, registrar el incidente con contextos de red de alta fidelidad es crucial.

Por defecto, Istio inyecta identidades **SPIFFE** (Secure Production Identity Framework for Everyone) dentro del encabezado `X-Forwarded-Client-Cert` (XFCC) de las solicitudes internas. Tu middleware debe capturar esta telemetría:

* **Trazabilidad de auditoría**: Registra el SPIFFE ID del servicio de origen (por ejemplo, `spiffe://cluster.local/ns/default/sa/krakend-sa`), la IP del cliente, los detalles del inquilino del JWT y la ruta del recurso objetivo.
* **Alertas**: Envía las violaciones de acceso directamente a tu pipeline de SIEM. Dado que el middleware se encuentra en el límite de la red, puedes detectar, alertar y mitigar intentos de violación al instante, mucho antes de que puedan sondear los nodos de tu base de datos backend.

---

## Conclusión

Delegar la autorización de grano fino a la Autorización Externa de Istio transforma cómo abordas la seguridad de tus aplicaciones. Tus microservicios se mantienen 100% ligeros, centrándose exclusivamente en la lógica de negocio. La seguridad se mantiene central, declarativa y aplicada de manera transparente por proxies sidecar de alto rendimiento que montan guardia en la puerta principal de tus pods.

*(¡Revisa nuestro diagrama de flujo de arquitectura y el diagrama de verificación paso a paso a continuación!)*

![Secuencia de Autorización Externa con Istio](/blog/2026-07-26-istio-external-authorization/architecture.png)

![Diagrama de Verificación de JWT Basado en Ruta](/blog/2026-07-26-istio-external-authorization/istio_ext_authz_diagram-es.png)

</div>
