# LinkedIn Drafts: Designing an Authorization API with Centralized Rule Storage

> 📷 **Image Recommendation**: Attach the image `public/blog/2026-08-02-design-authorization-api-centralized-rules/nomos-auth-design-en.png` (or `nomos-auth-design-es.png` for Spanish) to this post. It shows the complete Graph Authorization model and runtime resolution flow!
> Or upload a PDF to LinkedIn to create an interactive carousel of the architecture.

---

## English Version 🇺🇸

As engineering organizations scale to 100+ microservices, a recurring nightmare emerges: **Where and how do we manage authorization rules?** 🌀

Hardcoding authorization logic inside every single backend service leads to fragmented policies, audit headaches, and zero agility. But putting a heavy centralized service directly in the request hot path can introduce latency and create a critical single point of failure.

How do we solve this? **By separating the centralized rule store from local rule evaluation.** 🚀

Lately, I’ve been analyzing a high-performance architecture based on **Nomos**, a design that combines a Graph Database with an edge middleware for decentralized evaluation.

Here is how the design works under the hood:
1️⃣ **Centralized Graph Store (Java/Neo4j)**: Model identity providers (`IDP`), applications (`App`), gateways (`APIProxy`), path-based policies (`Rule`), and parameters (`Validation`) in a flexible graph structure.
2️⃣ **Gateway Integration**: The API gateway (like KrakenD) only validates the integrity of the JWT.
3️⃣ **High-Performance Evaluation (Go Middleware)**: An `ext_authz` sidecar close to your microservices fetches the policies from the graph store on cache-misses, evaluates path matching on the hot path, and caches results locally with configurable TTLs.
4️⃣ **Data Enrichment**: When JWT tokens lack required payload fields, the middleware dynamically queries enrichment endpoints (e.g., `/users/me`) and caches the response.

This ensures **consistent access control policies across all endpoints** without sacrifice in latency or scaling overhead.

I’ve prepared an initial skeleton and architecture diagrams of this system to break down the entire model, including how we handle nested path structures and multi-level validations.

Read the full design breakdown here:
👉 https://kiquetal.dev/blog/2026-08-02-design-authorization-api-centralized-rules

*(Check out the graph authorization model diagram below for a complete visual breakdown! 🗺️👇)*

How do you manage authorization rules at scale in your teams? Have you experimented with graph databases or centralized engines like OPA/Rego? Let's discuss in the comments! 👇

#APIArchitecture #SystemDesign #Authorization #Microservices #GraphDatabase #Neo4j #GoLang #Java #CloudNative #DevSecOps

---

## Versión en Español 🇪🇸

> 📷 **Recomendación de Imagen**: Adjunta la imagen `public/blog/2026-08-02-design-authorization-api-centralized-rules/nomos-auth-design-es.png` a esta publicación. ¡Muestra el modelo de autorización de grafo completo y el flujo de resolución en tiempo de ejecución!
> O sube un PDF a LinkedIn para crear un carrusel interactivo del diseño.

A medida que las organizaciones de ingeniería escalan a más de 100 microservicios, surge una pesadilla recurrente: **¿Dónde y cómo gestionamos las reglas de autorización?** 🌀

Codificar la lógica de autorización dentro de cada servicio backend individual conduce a políticas fragmentadas, pesadillas de auditoría y nula agilidad. Pero colocar un servicio centralizado pesado directamente en la ruta crítica de las solicitudes puede introducir latencia y crear un punto único de falla crítico.

¿Cómo resolvemos esto? **Separando el almacenamiento centralizado de reglas de la evaluación de reglas local.** 🚀

Últimamente he estado analizando una arquitectura de alto rendimiento basada en **Nomos**, un diseño que combina una Base de Datos de Grafos con un middleware en el extremo para la evaluación descentralizada.

Así es como funciona el diseño internamente:
1️⃣ **Almacén de Grafos Centralizado (Java/Neo4j)**: Modela proveedores de identidad (`IDP`), aplicaciones (`App`), gateways (`APIProxy`), políticas basadas en rutas (`Rule`) y parámetros (`Validation`) en una estructura de grafo flexible.
2️⃣ **Integración con el Gateway**: El API Gateway (como KrakenD) solo valida la integridad del JWT.
3️⃣ **Evaluación de Alto Rendimiento (Middleware en Go)**: Un sidecar de `ext_authz` cercano a tus microservicios obtiene las políticas del almacén de grafos en caso de fallos de caché, evalúa la coincidencia de rutas en la ruta crítica y almacena en caché los resultados localmente con TTL configurables.
4️⃣ **Enriquecimiento de Datos**: Cuando los tokens JWT carecen de campos necesarios en el payload, el middleware consulta dinámicamente endpoints de enriquecimiento (ej. `/users/me`) y guarda la respuesta en caché.

Esto garantiza **políticas de control de acceso consistentes en todos los endpoints** sin sacrificar latencia ni sobrecarga de escalabilidad.

He preparado un esqueleto inicial y diagramas de arquitectura de este sistema para desglosar todo el modelo, incluyendo cómo manejamos estructuras de rutas anidadas y validaciones multinivel.

Lee el desglose completo del diseño aquí:
👉 https://kiquetal.dev/blog/2026-08-02-design-authorization-api-centralized-rules

*(¡Mira el diagrama del modelo de autorización de grafos abajo para un desglose visual completo! 🗺️👇)*

¿Cómo gestionan las reglas de autorización a escala en sus equipos? ¿Han experimentado con bases de datos de grafos o motores de reglas centralizados como OPA/Rego? ¡Hablemos en los comentarios! 👇

#ArquitecturaDeSoftware #DiseñoDeSistemas #Autorizacion #Microservicios #BasesDeDatos #Neo4j #GoLang #Java #CloudNative #DevSecOps
