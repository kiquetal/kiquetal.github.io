# LinkedIn Drafts: Offloading Microservice Security with Istio ext_authz and Go

> 📷 **Image Recommendation**: Attach a clean screenshot of the Mermaid request flow sequence diagram from the blog post, showing the client request, Envoy interception, Custom Auth Middleware validation, and downstream forwarding!

---

## English Version 🇺🇸

Implementing authorization logic directly inside your microservice application code is a recipe for duplication, security debt, and hard-to-maintain rules. But how do we delegate validation safely without turning our services into an open playground? 🔐

The answer lies in **Istio's Custom External Authorization (`ext_authz`)** combined with high-performance validation middleware!

In my latest blog post, I show how to build and deploy a custom Go middleware that hooks directly into the **Envoy Sidecar** of your Kubernetes pods. 

Here is what makes this architecture incredibly elegant:
1️⃣ **Complete Separation of Concerns**: Your business services (like a Billing API) don't need to know anything about token signatures or OIDC rule checks. They focus 100% on business transactions.
2️⃣ **Mesh-Level Enforcement**: The Envoy sidecar intercepts incoming traffic *before* it touches your application container. 
3️⃣ **Lightweight Interception**: Envoy suspends the request, sends a synthetic check payload (only headers!) to our Go Auth Middleware, and allows/denies the connection based on a simple HTTP validation.
4️⃣ **Tale of Two Containers**: If validation fails (e.g., token verification mismatch), Envoy drops the request immediately at Container 1. Your application container (Container 2) never receives a byte—meaning its logs remain 100% clean of security noise!

I've shared the complete Go middleware implementation, the exact Istio registration specs, `AuthorizationPolicy` blocks, and raw logs straight from my local Minikube cluster showing the authentic `403 UAEX ext_authz_denied` in action.

Read the full technical deep-dive here:
👉 https://kiquetal.github.io/blog/2026-08-08-auth-ext-middleware

How are you handling microservice authorization inside Kubernetes? Have you migrated auth checks to the service mesh level, or are you still parsing tokens directly inside your microservices? Let’s share experiences in the comments! 👇

#Kubernetes #Istio #ServiceMesh #GoLang #EnvoyProxy #Microservices #CloudNative #PlatformEngineering #DevSecOps #APIArchitecture

---

## Versión en Español 🇪🇸

> 📷 **Recomendación de Imagen**: ¡Adjunta una captura limpia del diagrama de secuencia Mermaid del flujo de solicitudes, que muestra la petición del cliente, la interceptación de Envoy, la validación del middleware y el reenvío aguas abajo!

Implementar la lógica de autorización directamente en el código de tu microservicio es la receta ideal para duplicar código, generar deuda de seguridad y crear políticas difíciles de mantener. Pero, ¿cómo delegamos la validación de forma segura sin convertir nuestros servicios en un patio de recreo desprotegido? 🔐

¡La respuesta es la **Autorización Externa Personalizada (`ext_authz`) de Istio** combinada con un middleware en Go de alto rendimiento!

En mi última publicación del blog, explico cómo construir y desplegar un middleware personalizado en Go que se conecta directamente al **Envoy Sidecar** de tus pods de Kubernetes.

Así es como esta arquitectura simplifica la seguridad:
1️⃣ **Separación Absoluta de Responsabilidades**: Tus servicios de negocio (como una API de Facturación) no necesitan saber nada sobre firmas de tokens o validaciones OIDC. Se concentran al 100% en transacciones comerciales.
2️⃣ **Aplicación a Nivel de Service Mesh**: El proxy sidecar de Envoy intercepta el tráfico entrante *antes* de que toque el contenedor de tu aplicación.
3️⃣ **Interceptación Ultra-ligera**: Envoy pausa la solicitud, envía una petición de verificación sintética (¡solo cabeceras!) a nuestro Middleware de Autorización en Go, y permite o deniega la conexión basándose en una simple validación HTTP.
4️⃣ **La Historia de Dos Contenedores**: Si la validación falla (ej. discrepancia en el token), Envoy descarta la solicitud inmediatamente en el Contenedor 1. El contenedor de tu aplicación (Contenedor 2) nunca recibe un solo byte, ¡lo que mantiene tus logs limpios de intentos fallidos!

He compartido la implementación completa del middleware en Go, las especificaciones exactas de registro en Istio, bloques de `AuthorizationPolicy` y logs de acceso directos de mi clúster local de Minikube mostrando la denegación real `403 UAEX ext_authz_denied` en acción.

Lee el análisis técnico completo aquí:
👉 https://kiquetal.github.io/blog/2026-08-08-auth-ext-middleware

¿Cómo gestionas la autorización de microservicios en Kubernetes actualmente? ¿Has migrado estas comprobaciones al mesh, o sigues decodificando tokens en cada servicio? ¡Hablemos en los comentarios! 👇

#Kubernetes #Istio #ServiceMesh #GoLang #EnvoyProxy #Microservicios #CloudNative #DevSecOps #ArquitecturaDeSoftware #PlatformEngineering
