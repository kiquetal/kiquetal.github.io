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

## C1: System Context Diagram

At the highest level (System Context), we look at how the entire API and Service Mesh ecosystem interacts with the Client.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Context
  title System Context: External Authorization Flow

  Person(client, "Client", "A user or application making API requests.")
  System(api_system, "API & Service Mesh System", "Intercepts, validates, routes, and executes secure business transactions.")

  Rel(client, api_system, "Sends requests & queries resources", "HTTPS")
```

</div>

* Rendered Diagram: [c1-context.png](/blog/2026-08-08-auth-ext-middleware/c1-context.png)
* Source File: [`c1-context.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c1-context.puml)

---

## C2: Container Diagram (Istio Interception)

Zooming in to Level 2 (Containers), we see how our API and network proxy sidecars handle the incoming request and perform external delegation using Istio's built-in `ext_authz` capability.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Container
  title Container Diagram: Istio Request Interception & Ext Authz

  Person(client, "Client", "A user or application making API requests.")
  
  System_Boundary(mesh, "Kubernetes / Istio Service Mesh") {
    Container(gateway, "API Gateway", "KrakenD", "Stamps logical target service destination headers (X-Target-Service: billing-service).")
    
    System_Boundary(pod, "Billing Service Pod (K8s Pod)") {
        Container(sidecar, "Envoy Sidecar", "Envoy Proxy", "Intercepts inbound traffic for billing-service; delegates check via ext_authz.")
        Container(backend, "Billing Service", "Go / Microservice", "Executes secure billing-related business logic on localhost.")
    }
    
    Container(middleware, "Auth Middleware", "Go Service", "Handles token decoding, validation, and rule evaluation.")
  }

  Rel(client, gateway, "Sends API Request", "HTTPS")
  Rel(gateway, sidecar, "Routes request", "HTTP")
  Rel(sidecar, middleware, "Delegates authorization (via Istio ext_authz)", "HTTP/gRPC")
  Rel(middleware, sidecar, "Returns ALLOW (200 OK) / DENY", "HTTP Status")
  Rel(sidecar, backend, "Forwards authorized request", "Localhost HTTP")
```

</div>

* Rendered Diagram: [c2-container.png](/blog/2026-08-08-auth-ext-middleware/c2-container.png)
* Source File: [`c2-container.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c2-container.puml)

---

## C3: Component Diagram (Auth Middleware Internal)

Zooming in to Level 3 (Components) specifically for the **Auth Middleware** container, we see the decoupled internal design that ensures high performance and sub-millisecond validations.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Component
  title Component Diagram: Custom Auth Middleware Go Container

  Container(sidecar, "Envoy Sidecar", "Envoy Proxy", "Intercepts traffic, delegates auth checks via ext_authz, and forwards authorized requests.")
  Container(backend, "Billing Service", "Go / Microservice", "Executes secure billing-related business logic on localhost.")

  Container_Boundary(middleware, "Auth Middleware Go Container") {
    Component(router, "Main Control", "Go http.Handler", "Exposes /check; validates config properties: audience, iss, and apiproxy_name.")
    Component(l1, "L1 Cache", "Go In-Memory Map", "Fastest local cache inside Go process memory for sub-millisecond lookups.")
    Component(l2_client, "L2 Client", "Go Redis Client", "Optional client that checks L2 cache on local cache miss.")
    Component(sync, "Sync Client", "Go Routine", "Periodically pulls rule updates in the background.")
  }

  Container(redis, "L2 Cache (Optional)", "Redis Database", "Shared distributed memory cache across middleware replicas.")
  Container(nomos_api, "Nomos Central API", "HTTP Service", "Authoritative centralized rule storage.")

  Rel(sidecar, router, "Sends check request", "HTTP")
  Rel(router, l1, "Queries local rules", "Memory Read")
  Rel(router, l2_client, "Queries shared rules (on L1 miss)", "Go Function")
  Rel(l2_client, redis, "Fetches from Redis", "Redis protocol")
  Rel(sync, nomos_api, "Pulls rule updates", "HTTP Request")
  Rel(nomos_api, sync, "Returns active rules", "HTTP JSON Response")
  Rel(sync, l1, "Refreshes local rules", "Memory Write")
  Rel(sync, redis, "Updates shared rules", "Redis protocol")
  Rel(router, sidecar, "Returns ALLOW (200 OK) / DENY", "HTTP Status")
  Rel(sidecar, backend, "Forwards authorized request", "Localhost HTTP")
  Rel(router, sync, "Spawns background worker", "Go Routine")
```

</div>

* Rendered Diagram: [c3-component.png](/blog/2026-08-08-auth-ext-middleware/c3-component.png)
* Source File: [`c3-component.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c3-component.puml)

> [!TIP]
> You can also find our complete **Structurizr C4 DSL schema** for this architecture saved in the blog assets: [`structurizr.dsl`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/structurizr.dsl).

---

## Building the External Authorizer Middleware in Go

Go is an excellent choice for writing external authorizers due to its low memory footprint, rapid startup times, and rich networking capabilities. Below is a complete example of an HTTP-based authorizer middleware designed for Istio:

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
		w.WriteHeader(http.StatusForbidden)
		return
	}

	// 4. Respond with 200 OK to allow request, optionally adding enrichment headers
	log.Printf("Request authorized for service %s", targetService)
	w.Header().Set("X-Authorized-User", "user-123") // Envoy can forward this to your app!
	w.WriteHeader(http.StatusOK)
}

func isValidToken(token string) bool {
	// TODO: Add your custom logic here (JWT verification, rule evaluation etc.)
	return token == "super-secret-token"
}
```

---

## Your Turn: Add your custom notes and implementation details

[TODO: Add details here about how your specific middleware handles authorization, any caching strategies, or design patterns you implemented to keep it lightweight.]

</div>

<div class="lang-es hidden">

## Delegando la Seguridad al Service Mesh

Las arquitecturas modernas exigen que separemos las políticas de seguridad de la lógica de negocio. Implementar lógica de autorización dentro de microservicios individuales crea duplicidad de código e introduce posibles vulnerabilidades de seguridad si se olvida algún endpoint.

At aprovechar la **Autorización Externa CUSTOM de Istio (`ext_authz`)**, podemos interceptar las solicitudes entrantes directamente a nivel del proxy sidecar de Envoy y delegar la validación a un servicio middleware dedicado de alto rendimiento.

---

## C1: Diagrama de Contexto de Sistema

En el nivel más alto (Contexto de Sistema), observamos cómo todo el ecosistema de APIs y Service Mesh interactúa con el Cliente.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Context
  title Contexto de Sistema: Flujo de Autorización Externa

  Person(client, "Cliente", "Un usuario o aplicación que realiza peticiones a la API.")
  System(api_system, "API & Service Mesh System", "Intercepta, valida, enruta y ejecuta transacciones de negocio seguras.")

  Rel(client, api_system, "Envía peticiones y consulta recursos", "HTTPS")
```

</div>

* Diagrama Renderizado: [c1-context.png](/blog/2026-08-08-auth-ext-middleware/c1-context.png)
* Archivo Fuente: [`c1-context.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c1-context.puml)

---

## C2: Diagrama de Contenedores (Interceptación de Istio)

Haciendo zoom al Nivel 2 (Contenedores), vemos cómo nuestros contenedores de la API y proxies Envoy manejan la solicitud entrante y realizan la delegación externa utilizando la capacidad integrada `ext_authz` de Istio.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Container
  title Diagrama de Contenedores: Interceptación de Solicitudes y Ext Authz de Istio

  Person(client, "Cliente", "Un usuario o aplicación que realiza peticiones a la API.")
  
  System_Boundary(mesh, "Kubernetes / Istio Service Mesh") {
    Container(gateway, "API Gateway", "KrakenD", "Estampa cabeceras de destino de servicio lógico (X-Target-Service: billing-service).")
    
    System_Boundary(pod, "Pod del Servicio Billing (K8s Pod)") {
        Container(sidecar, "Envoy Sidecar", "Envoy Proxy", "Intercepta el tráfico entrante para billing-service; delega la verificación vía ext_authz.")
        Container(backend, "Servicio Billing", "Go / Microservicio", "Ejecuta la lógica de negocio de facturación segura en localhost.")
    }
    
    Container(middleware, "Auth Middleware", "Servicio en Go", "Maneja decodificación de tokens, validación y evaluación de reglas.")
  }

  Rel(client, gateway, "Envía petición API", "HTTPS")
  Rel(gateway, sidecar, "Enruta la petición", "HTTP")
  Rel(sidecar, middleware, "Delega la autorización (vía Istio ext_authz)", "HTTP/gRPC")
  Rel(middleware, sidecar, "Retorna ALLOW (200 OK) o DENY", "HTTP Status")
  Rel(sidecar, backend, "Reenvía la petición autorizada", "Loopback HTTP")
```

</div>

* Diagrama Renderizado: [c2-container.png](/blog/2026-08-08-auth-ext-middleware/c2-container.png)
* Archivo Fuente: [`c2-container.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c2-container.puml)

---

## C3: Diagrama de Componentes (Interno del Auth Middleware)

Haciendo zoom al Nivel 3 (Componentes) específicamente para el contenedor **Auth Middleware**, vemos el diseño interno desacoplado que garantiza validaciones en submilisegundos.

<div style="background-color: white; padding: 20px; border-radius: 8px; margin: 1.5rem 0;">

```mermaid
C4Component
  title Diagrama de Componentes: Contenedor Go de Middleware de Autorización

  Container(sidecar, "Envoy Sidecar", "Envoy Proxy", "Intercepta el tráfico, delega verificaciones de autorización vía ext_authz, y reenvía solicitudes autorizadas.")
  Container(backend, "Servicio Billing", "Go / Microservicio", "Ejecuta la lógica de negocio de facturación segura en localhost.")

  Container_Boundary(middleware, "Contenedor Go de Middleware de Autorización") {
    Component(router, "Main Control", "Go http.Handler", "Expone /check; valida propiedades de configuración: audience, iss y apiproxy_name.")
    Component(l1, "Caché L1", "Mapa en Memoria Go", "Caché local ultrarrápido dentro de la memoria del proceso Go para búsquedas en submilisegundos.")
    Component(l2_client, "Cliente L2", "Cliente Redis Go", "Cliente opcional que consulta el caché L2 en caso de fallo en el caché local.")
    Component(sync, "Cliente de Sincronización", "Go Routine", "Tira de actualizaciones periódicamente en segundo plano.")
  }

  Container(redis, "Caché L2 (Opcional)", "Base de Datos Redis", "Caché de memoria compartida distribuida entre réplicas de middleware.")
  Container(nomos_api, "API Central de Nomos", "Servicio HTTP", "Almacenamiento autoritativo centralizado de reglas.")

  Rel(sidecar, router, "Envía petición de verificación", "HTTP")
  Rel(router, l1, "Consulta reglas locales", "Lectura de Memoria")
  Rel(router, l2_client, "Consulta reglas compartidas (si falla L1)", "Función Go")
  Rel(l2_client, redis, "Trae datos de Redis", "Protocolo Redis")
  Rel(sync, nomos_api, "Tira de actualizaciones de reglas", "Petición HTTP")
  Rel(nomos_api, sync, "Retorna reglas activas", "Respuesta JSON HTTP")
  Rel(sync, l1, "Actualiza reglas locales", "Escritura en Memoria")
  Rel(sync, redis, "Actualiza reglas compartidas", "Protocolo Redis")
  Rel(router, sidecar, "Retorna ALLOW (200 OK) / DENY", "HTTP Status")
  Rel(sidecar, backend, "Reenvía la petición autorizada", "Localhost HTTP")
  Rel(router, sync, "Dispara worker en segundo plano", "Go Routine")
```

</div>

* Diagrama Renderizado: [c3-component.png](/blog/2026-08-08-auth-ext-middleware/c3-component.png)
* Archivo Fuente: [`c3-component.puml`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/c3-component.puml)

> [!TIP]
> Puedes encontrar nuestro **esquema de Structurizr C4 DSL** completo para esta arquitectura guardado en los recursos del blog: [`structurizr.dsl`](file:///mydata/codes/2026/kiquetal.github.io/public/blog/2026-08-08-auth-ext-middleware/structurizr.dsl).

---

## Construyendo el Middleware Autorizador Externo en Go

Go es una excelente opción para escribir autorizadores externos debido a su bajo consumo de memoria, tiempos de inicio rápidos y ricas capacidades de red. A continuación, se presenta un ejemplo completo de un autorizador basado en HTTP diseñado para Istio:

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
	// 1. Extraer cabeceras de contexto enviadas por Istio Envoy
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
		w.WriteHeader(http.StatusForbidden)
		return
	}

	// 4. Responder con 200 OK para permitir la solicitud, opcionalmente agregando cabeceras de enriquecimiento
	log.Printf("Solicitud autorizada para el servicio %s", targetService)
	w.Header().Set("X-Authorized-User", "user-123") // ¡Envoy puede reenviar esto a tu aplicación!
	w.WriteHeader(http.StatusOK)
}

func isValidToken(token string) bool {
	// TODO: Agrega tu lógica personalizada aquí (verificación JWT, evaluación de reglas, etc.)
	return token == "super-secret-token"
}
```

---

## Tu turno: Agrega tus notas personalizadas y detalles de implementación

[TODO: Agrega detalles aquí sobre cómo tu middleware específico maneja la autorización, cualquier estrategia de caché o patrones de diseño que implementaste para mantenerlo ligero.]

</div>
