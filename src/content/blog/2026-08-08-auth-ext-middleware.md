---
title:
  en: 'Building an external authorization extension with middleware'
  es: 'Construyendo una extensión de autorización externa con middleware'
excerpt:
  en: 'A step-by-step guide on how to build a highly optimized HTTP/gRPC external authorizer middleware for Istio and secure your services at the mesh layer.'
  es: 'Una guía paso a paso sobre cómo construir un middleware autorizador externo HTTP/gRPC altamente optimizado para Istio y asegurar tus servicios en la capa de mesh.'
date: 2026-08-08
tags: ['authorization', 'middleware', 'istio', 'go', 'security']
draft: true
---

<div class="lang-en">

## Offloading Security to the Service Mesh

Modern architectures demand that we decouple security policies from business logic. Implementing authorization logic inside individual microservices creates code duplication and introduces potential security vulnerabilities if an endpoint is forgotten. 

By leveraging **Istio's CUSTOM External Authorization (`ext_authz`)**, we can intercept incoming requests right at the Envoy sidecar proxy level and delegate validation to a dedicated, high-performance middleware service.

---

### Request Flow Sequence

This step-by-step sequence diagram details exactly how requests are routed, validated by our middleware, and then forwarded downstream to execute business logic:

![Request Flow Sequence Diagram](/blog/2026-08-08-auth-ext-middleware/request-flow.png)

---

## Token Scope Resolution with Istio ext_authz

We encountered a challenge when attempting to grant restricted access to a security principal in our infrastructure running on Kubernetes with Istio. 

Specifically, we deployed an API Gateway at the ingress layer integrated with authentication via an external OIDC 2.0 Identity Provider (IDP). However, we could not restrict the token's scope to a specific subset of services because the token we received was simply an `ID_TOKEN`. To resolve this scope limitation, we leveraged the **Custom Authorization (External Authorizer)** capability in Istio:

* Official Documentation: [Istio Custom Authorization (ext_authz)](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/)

### Registering the Custom External Authorizer in Istio

Before applying authorization policies, we must register our custom authorizer middleware inside the Istio `MeshConfig` configuration (usually in your `istio-system` configmap or via your IstioOperator):

```yaml
meshConfig:
  extensionProviders:
  - name: "custom-auth-middleware"
    envoyExtAuthzHttp:
      service: "auth-middleware.auth-system.svc.cluster.local"
      port: "8080"
      path: "/check"
      includeRequestHeadersInCheck: 
        - "authorization"
        - "x-target-service"
      headersToUpstreamOnAllow: 
        - "x-authorized-user"
```

### Applying the AuthorizationPolicy (AP)

Once registered, you activate the custom external authorizer for specific workloads using an `AuthorizationPolicy` with the `CUSTOM` action:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: ext-auth-policy
  namespace: billing-system
spec:
  selector:
    matchLabels:
      app: billing-service
  action: CUSTOM
  provider:
    name: "custom-auth-middleware"
  rules:
  - to:
    - operation:
        paths: ["/billing/*"]
```

---

## Building the External Authorizer Middleware in Go

Go is an excellent choice for writing external authorizers due to its low memory footprint, rapid startup times, and rich networking capabilities. 

![External Authorizer Middleware Component Architecture](/blog/2026-08-08-auth-ext-middleware/c3-component.png)

Below is a complete example of an HTTP-based authorizer middleware designed for Istio:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
)

func main() {
	http.HandleFunc("/check", checkAuth)
	log.Println("Auth middleware listening on :8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func checkAuth(w http.ResponseWriter, r *http.Request) {
	// 1. Extract context headers forwarded by Istio Envoy
	authHeader := r.Header.Get("Authorization")
	targetService := r.Header.Get("X-Target-Service")
	
	log.Printf("Received check request for service: %s", targetService)

	// 2. Validate Token (In production, decode and verify your JWT/Token)
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		log.Println("Authorization header missing or invalid format")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	
	// 3. Evaluate access rules (Example of path or metadata matching)
	if !isValidToken(token) {
		log.Println("Token validation failed")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	// 4. Respond with 200 OK to allow request, optionally adding enrichment headers
	log.Printf("Request authorized for service %s", targetService)
	w.Header().Set("X-Authorized-User", "user-123") // Envoy can forward this to your app!
	w.WriteHeader(http.StatusOK)
}

func isValidToken(token string) bool {
	// Custom rules validation
	return token == "super-secret-token"
}
```

---

## Real-World Kubernetes Pod Logs (A Tale of Two Containers)

Inside our `billing-service` Kubernetes Pod, we run **two separate containers** in a sidecar pattern. Here is exactly how their logs differ, showing that the proxy sidecar handles rejections before they can ever hit the downstream application container:

### 1. Custom Auth Middleware Logs (External Service)
```log
2026/08/09 01:04:54 Received request from 127.0.0.6:54943 | Method: GET | Host/Service: httpbin:8000 | Path: /headers
2026/08/09 01:04:54 --- Incoming Headers ---
2026/08/09 01:04:54 Content-Length: 0
2026/08/09 01:04:54 X-Forwarded-Proto: https
2026/08/09 01:04:54 X-Request-Id: daa4fae4-c062-4f15-9ae1-da522e5a6ece
2026/08/09 01:04:54 X-Forwarded-Client-Cert: By=spiffe://cluster.local/ns/foo/sa/default;Hash=74f738d5be270b155a1ff5902fe0cc9a0d89fd10a6d1983c5f4c01a4f8f192a9;Subject="";URI=spiffe://cluster.local/ns/foo/sa/default
2026/08/09 01:04:54 ------------------------
2026/08/09 01:04:54 Action: DENY - Reason: missing-authorization-header | Message: The Authorization header is required.

2026/08/09 01:07:44 Received request from 127.0.0.6:57649 | Method: GET | Host/Service: dummy-svc-app:8080 | Path: /v1/customer/123456789
2026/08/09 01:07:44 --- Incoming Headers ---
2026/08/09 01:07:44 Content-Length: 0
2026/08/09 01:07:44 Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiQWxpY2UiLCJtc2lzZG4iOiIxMjM0NTY3ODkifQ==.signature
2026/08/09 01:07:44 X-Forwarded-Proto: https
2026/08/09 01:07:44 X-Request-Id: afb37c6d-ef75-4e9a-8096-2c7be9f9f384
2026/08/09 01:07:44 X-Forwarded-Client-Cert: By=spiffe://cluster.local/ns/foo/sa/default;Hash=74b7b906cb9435fcf73f37b08b7050cfa771105658b3a683faf0be0832eec256;Subject="";URI=spiffe://cluster.local/ns/foo/sa/default
2026/08/09 01:07:44 ------------------------
2026/08/09 01:07:44 Parsed JWT: Name=Alice, TokenMSISDN=123456789 | Requested Path MSISDN: 123456789
2026/08/09 01:07:44 Action: ALLOW - Token MSISDN matches Path MSISDN! User=Alice

```

### 2. Envoy Sidecar Proxy Logs (Container 1 inside Billing Pod)
> [!NOTE]
> The Envoy Sidecar interceptor sees **all** requests. For the denied request, Envoy logs standard status code `403` with the custom response flag **`UAEX`**, indicating rejection by the external authorizer without hitting the downstream server:
```log
[2026-08-09T00:55:12.156Z] "GET /v1/customer/123456789 HTTP/1.1" 200 - via_upstream - "-" 0 634 21 12 "-" "curl/8.2.1" "8b8aedf5-e4e1-42af-a7e3-214c73b71d76" "dummy-svc-app:8080" "10.244.0.28:8080" inbound|8080|| 127.0.0.6:55597 10.244.0.28:8080 10.244.0.30:52152 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
[2026-08-09T00:56:18.465Z] "GET /v1/customer/123456789 HTTP/1.1" 403 UAEX ext_authz_denied - "-" 0 125 11 - "-" "curl/8.2.1" "78adb6f2-1fad-4e0c-a786-03def12899ae" "dummy-svc-app:8080" "-" inbound|8080|| - 10.244.0.28:8080 10.244.0.30:36340 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
[2026-08-09T00:56:21.195Z] "GET /v1/customer/3434234234 HTTP/1.1" 403 UAEX ext_authz_denied - "-" 0 142 1 - "-" "curl/8.2.1" "e0752295-01ae-4dae-9611-54656cb48ba1" "dummy-svc-app:8080" "-" inbound|8080|| - 10.244.0.28:8080 10.244.0.30:52152 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
```



### 3. Billing Service Logs (Container 2 inside Billing Pod)
> [!IMPORTANT]
> Because Envoy terminated the unauthorized request at `22:42:15`, **absolutely no request was made to our application container**! The Billing Service application logs only ever see successful traffic, remaining 100% clean of security noise:

```log
2026/08/09 00:55:12 Received request for path: /v1/customer/123456789
2026/08/09 01:00:16 Received request for path: /v1/customer/123456789
# Note: The unauthorized request at 22:42:15 was blocked by Envoy and never reached this container!
```

</div>

<div class="lang-es hidden">

## Delegando la Seguridad al Service Mesh

Las arquitecturas modernas exigen que separemos las políticas de seguridad de la lógica de negocio. Implementar lógica de autorización dentro de microservicios individuales crea duplicidad de código e introduce posibles vulnerabilidades de seguridad si se olvida algún endpoint.

Al aprovechar la **Autorización Externa CUSTOM de Istio (`ext_authz`)**, podemos interceptar las solicitudes entrantes directamente a nivel del proxy sidecar de Envoy y delegar la validación a un servicio middleware dedicado de alto rendimiento.

---

### Secuencia del Flujo de Solicitud

Este diagrama de secuencia paso a paso detalla exactamente cómo se enrutan las solicitudes, se validan mediante nuestro middleware y se reenvían aguas abajo para ejecutar la lógica de negocio:

![Diagrama de Secuencia del Flujo de Solicitudes](/blog/2026-08-08-auth-ext-middleware/request-flow.png)

---

## Resolviendo el Alcance del Token con Istio ext_authz

Identificamos el problema al intentar dar acceso limitado a un principal específico en nuestra infraestructura corriendo sobre Kubernetes con Istio. 

Habíamos colocado un API Gateway al frente asociado con autenticación mediante un IDP externo con OIDC 2.0. Sin embargo, no podíamos restringir el acceso del token solo a un subconjunto específico de servicios porque el token que recibíamos era simplemente un `ID_TOKEN`. Para resolver esta limitación de alcance, recurrimos a la funcionalidad de **Autorización Personalizada (Autorizador Externo)** de Istio:

* Documentación Oficial: [Istio Custom Authorization (ext_authz)](https://istio.io/latest/docs/tasks/security/authorization/authz-custom/)

### Registrando el Autorizador Externo en Istio

Antes de aplicar las políticas de autorización, debemos registrar nuestro servicio middleware de autorización dentro de la configuración de `MeshConfig` de Istio (normalmente configurado en el configmap `istio` dentro de `istio-system` o a través del recurso IstioOperator):

```yaml
meshConfig:
  extensionProviders:
  - name: "custom-auth-middleware"
    envoyExtAuthzHttp:
      service: "auth-middleware.auth-system.svc.cluster.local"
      port: "8080"
      path: "/check"
      includeRequestHeadersInCheck: 
        - "authorization"
        - "x-target-service"
      headersToUpstreamOnAllow: 
        - "x-authorized-user"
```

### Aplicando la AuthorizationPolicy (AP)

Una vez registrado, activas el autorizador externo personalizado para cargas de trabajo específicas utilizando una `AuthorizationPolicy` con la acción `CUSTOM`:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: ext-auth-policy
  namespace: billing-system
spec:
  selector:
    matchLabels:
      app: billing-service
  action: CUSTOM
  provider:
    name: "custom-auth-middleware"
  rules:
  - to:
    - operation:
        paths: ["/billing/*"]
```

---

## Construyendo el Middleware Autorizador Externo en Go

Go es una excelente opción para escribir autorizadores externos debido a su bajo consumo de memoria, tiempos de inicio rápidos y ricas capacidades de red. 

![Arquitectura de Componentes del Middleware de Autorización](/blog/2026-08-08-auth-ext-middleware/c3-component.png)

A continuación, se presenta un ejemplo completo de un autorizador basado en HTTP diseñado para Istio:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
)

func main() {
	http.HandleFunc("/check", checkAuth)
	log.Println("Auth middleware listening on :8080...")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func checkAuth(w http.ResponseWriter, r *http.Request) {
	// 1. Extraer cabeceras de contexto reenviadas por Istio Envoy
	authHeader := r.Header.Get("Authorization")
	targetService := r.Header.Get("X-Target-Service")
	
	log.Printf("Petición de verificación recibida para el servicio: %s", targetService)

	// 2. Validar el Token (En producción, decodifica y verifica tu JWT/Token)
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		log.Println("Cabecera de autorización ausente o formato inválido")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	
	// 3. Evaluar reglas de acceso (Ejemplo de coincidencia de ruta o metadatos)
	if !isValidToken(token) {
		log.Println("Fallo en la validación del token")
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	// 4. Responder con 200 OK para permitir la solicitud, opcionalmente agregando cabeceras de enriquecimiento
	log.Printf("Solicitud autorizada para el servicio %s", targetService)
	w.Header().Set("X-Authorized-User", "user-123") // ¡Envoy puede reenviar esto a tu aplicación!
	w.WriteHeader(http.StatusOK)
}

func isValidToken(token string) bool {
	// Validación de reglas personalizadas
	return token == "super-secret-token"
}
```

---

## Logs Reales en Kubernetes (La Historia de Dos Contenedores)

Dentro de nuestro Pod de Kubernetes `billing-service`, ejecutamos **dos contenedores independientes** siguiendo un patrón sidecar. Así difieren sus logs, demostrando que el proxy sidecar gestiona los rechazos antes de que toquen el contenedor de nuestra aplicación:

### 1. Logs de Middleware Auth Personalizado (Servicio Externo)
```log
2026/08/09 01:04:54 Received request from 127.0.0.6:54943 | Method: GET | Host/Service: httpbin:8000 | Path: /headers
2026/08/09 01:04:54 --- Incoming Headers ---
2026/08/09 01:04:54 Content-Length: 0
2026/08/09 01:04:54 X-Forwarded-Proto: https
2026/08/09 01:04:54 X-Request-Id: daa4fae4-c062-4f15-9ae1-da522e5a6ece
2026/08/09 01:04:54 X-Forwarded-Client-Cert: By=spiffe://cluster.local/ns/foo/sa/default;Hash=74f738d5be270b155a1ff5902fe0cc9a0d89fd10a6d1983c5f4c01a4f8f192a9;Subject="";URI=spiffe://cluster.local/ns/foo/sa/default
2026/08/09 01:04:54 ------------------------
2026/08/09 01:04:54 Action: DENY - Reason: missing-authorization-header | Message: The Authorization header is required.

2026/08/09 01:07:44 Received request from 127.0.0.6:57649 | Method: GET | Host/Service: dummy-svc-app:8080 | Path: /v1/customer/123456789
2026/08/09 01:07:44 --- Incoming Headers ---
2026/08/09 01:07:44 Content-Length: 0
2026/08/09 01:07:44 Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiQWxpY2UiLCJtc2lzZG4iOiIxMjM0NTY3ODkifQ==.signature
2026/08/09 01:07:44 X-Forwarded-Proto: https
2026/08/09 01:07:44 X-Request-Id: afb37c6d-ef75-4e9a-8096-2c7be9f9f384
2026/08/09 01:07:44 X-Forwarded-Client-Cert: By=spiffe://cluster.local/ns/foo/sa/default;Hash=74b7b906cb9435fcf73f37b08b7050cfa771105658b3a683faf0be0832eec256;Subject="";URI=spiffe://cluster.local/ns/foo/sa/default
2026/08/09 01:07:44 ------------------------
2026/08/09 01:07:44 Parsed JWT: Name=Alice, TokenMSISDN=123456789 | Requested Path MSISDN: 123456789
2026/08/09 01:07:44 Action: ALLOW - Token MSISDN matches Path MSISDN! User=Ali
```

### 2. Logs del Proxy Sidecar de Envoy (Contenedor 1 dentro del Pod Billing)
> [!NOTE]
> El sidecar de Envoy registra **todas** las peticiones. Para la solicitud denegada, Envoy registra el código de estado `403` con el flag de respuesta **`UAEX`**, que indica el rechazo del autorizador externo antes de llamar al servidor real:

```log
[2026-08-09T00:55:12.156Z] "GET /v1/customer/123456789 HTTP/1.1" 200 - via_upstream - "-" 0 634 21 12 "-" "curl/8.2.1" "8b8aedf5-e4e1-42af-a7e3-214c73b71d76" "dummy-svc-app:8080" "10.244.0.28:8080" inbound|8080|| 127.0.0.6:55597 10.244.0.28:8080 10.244.0.30:52152 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
[2026-08-09T00:56:18.465Z] "GET /v1/customer/123456789 HTTP/1.1" 403 UAEX ext_authz_denied - "-" 0 125 11 - "-" "curl/8.2.1" "78adb6f2-1fad-4e0c-a786-03def12899ae" "dummy-svc-app:8080" "-" inbound|8080|| - 10.244.0.28:8080 10.244.0.30:36340 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
[2026-08-09T00:56:21.195Z] "GET /v1/customer/3434234234 HTTP/1.1" 403 UAEX ext_authz_denied - "-" 0 142 1 - "-" "curl/8.2.1" "e0752295-01ae-4dae-9611-54656cb48ba1" "dummy-svc-app:8080" "-" inbound|8080|| - 10.244.0.28:8080 10.244.0.30:52152 outbound_.8080_._.dummy-svc-app.foo.svc.cluster.local default
```

### 3. Logs de la Aplicación Billing Service (Contenedor 2 dentro del Pod Billing)
> [!IMPORTANT]
> Dado que Envoy finalizó la petición no autorizada a las `01:04:54`, **¡ninguna solicitud llegó al contenedor de nuestra aplicación!** Los logs del backend solo registran el tráfico exitoso, libres del ruido de seguridad:

```log
2026/08/09 00:55:12 Received request for path: /v1/customer/123456789
2026/08/09 01:00:16 Received request for path: /v1/customer/123456789
# Nota: ¡La solicitud no autorizada de las 01:04:54 fue bloqueada por Envoy y nunca llegó a este contenedor!
```

</div>
