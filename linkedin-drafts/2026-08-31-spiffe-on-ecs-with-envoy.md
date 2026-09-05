# LinkedIn Draft: SPIFFE on ECS with Envoy — A Poor Man's Zero Trust

> 📷 **Image Recommendation**: Attach the Proteus container diagram (SPIRE Server Task + two service tasks with app, Envoy sidecar egress :9903 / ingress :9902, and SPIRE Agent) from the blog.

> ⚠️ **Note**: Before publishing, flip the blog post to `draft: false`, fill in the `excerpt`, and deploy so the link points at finished content.

---
## English Version

How do you get zero-trust mTLS on ECS Fargate when there's no EC2 instance to attest against? 🔐

I love Istio — but I wanted to understand what actually happens under the hood. So I built **Proteus**: an mTLS mesh for Amazon ECS from scratch, using SPIFFE/SPIRE + Envoy. A "poor man's zero trust," but every piece is one I now genuinely understand.

The hard part: on Fargate there's no host, so the usual `aws_iid` node attestor doesn't apply. I wrote a custom SPIRE plugin that reads the ECS task metadata endpoint — then verifies it **server-side** via the ECS API (`DescribeTasks`) against an IAM-role allow-list. A task can *claim* an ARN, but it can't fake one.

Identity is established in two layers:

1️⃣ **Node attestation** — SPIRE decides which *task* it trusts.
2️⃣ **Workload attestation + admission** — an admission controller decides which *service identity* that task is allowed to hold.

The result is deny-by-default — I call it **"dark until admitted."** No workload gets an SVID until it's explicitly admitted. The moment the admission controller creates the SPIRE entry, the SVID flows over SDS, Envoy completes the mTLS handshake, and service-a → service-b starts working — all with short-lived X.509 certs and zero long-lived secrets ever touching the app.

If you've done SPIFFE/SPIRE on Kubernetes, ECS forces you to rethink a few assumptions (node vs workload attestation, sharing a Unix socket across containers in a task, and where the SPIRE agent actually lives). I wrote up the architecture, the reasoning, and the dark-vs-live walkthrough with real logs.

Read the full technical deep-dive:
👉 https://kiquetal.github.io/blog/2026-08-31-spiffe-on-ecs-with-envoy

---
## Versión en Español

¿Cómo lograr mTLS zero-trust en ECS Fargate cuando no hay una instancia EC2 contra la cual atestar? 🔐

Me gusta Istio — pero quería entender qué pasa realmente por debajo. Así que construí **Proteus**: una malla mTLS para Amazon ECS desde cero, usando SPIFFE/SPIRE + Envoy. Una versión "casera" de zero trust, pero donde entiendo cada pieza.

La parte difícil: en Fargate no hay host, así que el atestador de nodo habitual `aws_iid` no aplica. Escribí un plugin propio de SPIRE que lee el endpoint de metadata de la tarea ECS — y luego lo verifica **del lado del servidor** vía la API de ECS (`DescribeTasks`) contra una lista de roles IAM permitidos. Una tarea puede *afirmar* un ARN, pero no puede falsificarlo.

La identidad se establece en dos capas:

1️⃣ **Atestación de nodo** — SPIRE decide en qué *tarea* confía.
2️⃣ **Atestación de workload + admisión** — un admission controller decide qué *identidad de servicio* puede tener esa tarea.

El resultado es denegar-por-defecto — lo llamo **"oscuro hasta ser admitido."** Ningún workload obtiene un SVID hasta ser admitido explícitamente. En el momento en que el admission controller crea la entrada en SPIRE, el SVID fluye vía SDS, Envoy completa el handshake mTLS, y service-a → service-b empieza a funcionar — todo con certificados X.509 de corta duración y cero secretos de larga duración tocando la aplicación.

Si ya hiciste SPIFFE/SPIRE en Kubernetes, ECS te obliga a repensar varias suposiciones (atestación de nodo vs. workload, compartir un socket Unix entre contenedores de una tarea, y dónde vive el agente SPIRE). Documenté la arquitectura, el razonamiento y el recorrido oscuro-vs-activo con logs reales.

Lee el análisis completo:
👉 https://kiquetal.github.io/blog/2026-08-31-spiffe-on-ecs-with-envoy

#SPIFFE #SPIRE #ECS #Envoy #mTLS #ZeroTrust #AWS #CloudSecurity #Fargate #DevSecOps #PlatformEngineering
