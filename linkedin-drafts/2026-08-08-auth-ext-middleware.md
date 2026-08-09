# LinkedIn Draft: Offloading Microservice Security with Istio ext_authz and Go

> 📷 **Image Recommendation**: Attach a clean screenshot of your updated request-flow sequence diagram from the blog!

---
## English Version

Implementing authorization inside microservice code creates security debt and code duplication. How do we delegate validation safely without leaving services exposed? 🔐

The answer: **Istio's Custom External Authorization (`ext_authz`)** combined with a high-performance **Go middleware**!

By hooking directly into the **Envoy Sidecar** of your Kubernetes pods, we achieve a robust security posture:

1️⃣ **Separation of Concerns**: Business APIs (like Billing) stay 100% focused on logic—no token/OIDC validation code inside your app.
2️⃣ **Mesh-Level Security**: Envoy sidecars intercept incoming traffic *before* it can reach your application container.
3️⃣ **Fast Interception**: Envoy suspends requests and sends only headers to the lightweight Go middleware for lightning-fast HTTP checks.
4️⃣ **Zero Garbage Telemetry**: Unauthorized requests fail-fast at Envoy. Your app never receives a byte, keeping logs 100% clean of security noise!

I've shared the complete Go implementation, Istio specs, `AuthorizationPolicy` blocks, and raw logs straight from my local Minikube cluster in my new blog post.

Read the full technical deep-dive here:
👉 https://kiquetal.github.io/blog/2026-08-08-auth-ext-middleware

---
## Versión en Español

Implementar la lógica de autorización en el microservicio genera deuda técnica y código duplicado. ¿Cómo delegamos la validación de forma segura? 🔐

La respuesta: **Autorización Externa Personalizada (`ext_authz`) de Istio** con un **middleware en Go** de alto rendimiento.

Al conectarlo directamente al **Envoy Sidecar** de tus pods de Kubernetes, logras una arquitectura robusta:

1️⃣ **Separación de Responsabilidades**: Tus APIs se enfocan al 100% en el negocio—cero código de validación de tokens en la aplicación.
2️⃣ **Seguridad a Nivel de Mesh**: El proxy Envoy intercepta el tráfico *antes* de que toque tu contenedor backend.
3️⃣ **Intercepción Veloz**: Envoy envía solo cabeceras al middleware en Go para una verificación HTTP ultra rápida y eficiente.
4️⃣ **Cero Telemetría Basura**: Las solicitudes rechazadas fallan rápido en Envoy. Tu aplicación nunca recibe tráfico no autorizado, manteniendo los logs limpios.

Comparto la implementación en Go, specs de Istio, políticas de autorización y logs reales en Minikube en el artículo.

Lee el análisis completo aquí:
👉 https://kiquetal.github.io/blog/2026-08-08-auth-ext-middleware

#Kubernetes #Istio #ServiceMesh #GoLang #EnvoyProxy #Microservices #CloudNative #DevSecOps #SoftwareArchitecture #PlatformEngineering
