# LinkedIn Draft: SPIFFE on ECS with Envoy — A Poor Man's Zero Trust

> 📷 **Image Recommendation**: Attach the C4 Container diagram (SPIRE Server, Admission Controller, Envoy sidecars) from the blog.

> ⚠️ **Note**: The blog post is still `draft: true` with a `TODO` excerpt. Flesh out the article before publishing this post so the link points at finished content.

---
## English Version

I love Istio, but I wanted to understand what actually happens under the hood. So I rebuilt a "poor man's zero trust" on Amazon ECS — mTLS between services, no long-lived secrets, workload identity that rotates automatically. 🔐

The stack:

1️⃣ **SPIRE Server + Admission Controller** — gate exactly which workloads are allowed to register their identity.
2️⃣ **SPIRE Agent + Envoy sidecar** per task — issue and consume X.509 SVIDs as the identity primitive.
3️⃣ **Envoy over SDS** (Secret Discovery Service) — pull SVIDs dynamically and drive the mTLS handshake, with rotation handled automatically.

The interesting parts weren't the happy path — they were the ECS-specific gotchas:

- Node vs workload attestation on ECS
- Sharing a Unix domain socket between containers in a single task
- The Fargate-vs-EC2 tradeoff for where the SPIRE agent actually lives

If you've done SPIFFE/SPIRE on Kubernetes, ECS forces you to rethink a few assumptions. I wrote up the architecture and the reasoning.

Read the full technical deep-dive here:
👉 https://kiquetal.github.io/blog/2026-08-31-spiffe-on-ecs-with-envoy

---
## Versión en Español

Me gusta Istio, pero quería entender qué pasa realmente por debajo. Así que reconstruí una versión "casera" de zero trust sobre Amazon ECS — mTLS entre servicios, sin secretos de larga duración e identidad de workload que rota automáticamente. 🔐

El stack:

1️⃣ **SPIRE Server + Admission Controller** — controlar exactamente qué workloads pueden registrar su identidad.
2️⃣ **SPIRE Agent + sidecar Envoy** por tarea — emitir y consumir SVIDs X.509 como primitiva de identidad.
3️⃣ **Envoy vía SDS** (Secret Discovery Service) — obtener los SVIDs de forma dinámica y ejecutar el handshake mTLS, con rotación automática.

Lo interesante no fue el camino feliz, sino los detalles propios de ECS:

- Atestación de nodo vs. de workload en ECS
- Compartir un socket Unix entre contenedores de una misma tarea
- El compromiso Fargate vs. EC2 para decidir dónde vive el agente SPIRE

Si ya hiciste SPIFFE/SPIRE en Kubernetes, ECS te obliga a repensar varias suposiciones. Documenté la arquitectura y el razonamiento.

Lee el análisis completo aquí:
👉 https://kiquetal.github.io/blog/2026-08-31-spiffe-on-ecs-with-envoy

#SPIFFE #SPIRE #ECS #Envoy #mTLS #ZeroTrust #AWS #CloudSecurity #DevSecOps #PlatformEngineering
