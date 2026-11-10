# LinkedIn Post: The IMDS Hop Limit, Explained by Topology (Host, Docker, EKS — and the NAT Myth)

> 📷 **Image to upload**: `assets/2026-11-09-imds-hop-limit-topologies.png`
> (four-scenario topology diagram: host direct = limit 1, Docker on EC2 = limit 2, EKS pod = keep 1 + IRSA/Pod Identity, NAT/internet = unrelated because IMDS is link-local).

> ⚠️ **LinkedIn formatting rule**: LinkedIn does NOT support Markdown and collapses single line breaks. Everything below the "READY TO POST" marker uses a BLANK LINE between every block and `▸` as manual bullets. Copy it verbatim — keep the blank lines — and it will paste cleanly. Do not re-wrap or remove the empty lines.

> 🔗 **Companion post**: this is the IMDSv2 hop-limit deep-dive that pairs with the credential-replay incident post. Both link to the same canonical write-up.

> 📣 **Amplification**: full bilingual write-up (with this diagram) at https://kiquetal.dev/blog/2026-11-09-vpc-bound-instance-credentials — post on LinkedIn AND cross-post to the AWS Builder Center with the blog as canonical source.

---
## ✅ READY TO POST — English (copy verbatim, keep blank lines)

"Just set the IMDS hop limit to 1." Good advice — until your container can't read its credentials and you bump it to 2 without knowing what you just opened up. 🧵

The hop limit is one number, but what it should be depends entirely on your topology. Here's the whole picture. 👇

First, what the number actually is:

The IMDS response leaves the metadata service with its IP TTL set to the hop limit. Every network hop subtracts 1. TTL hits 0 → the packet is dropped. That's it. It's a TTL guardrail that stops the credential response from travelling off the host.

Now, by topology:

▸ Process on the host (EC2 directly): 0 extra hops. Reply leaves with TTL 1, arrives with TTL 1. → Hop limit 1. This is the secure default (and what Amazon Linux 2023 sets).

▸ Container on EC2 (Docker / ECS on EC2): the docker0 bridge adds ONE hop. With limit 1, TTL hits 0 at the bridge and the reply is dropped — your container's credential call just hangs. → You need hop limit 2, but ONLY if the container itself reads IMDS.

▸ EKS pod: do NOT reflexively set 2. Limit 2 lets any pod — or an SSRF inside any pod — read the WORKER NODE's instance role. That's a privilege-escalation path. → Keep the limit at 1 and give the pod its OWN identity with IRSA or EKS Pod Identity. The pod gets a projected token and its own IAM role, and never touches the node's IMDS credentials.

And the misconception I see constantly:

▸ NAT / internet egress has NOTHING to do with the hop limit. IMDS is link-local (169.254.169.254) — it is never routed, never NAT'd, never sent through an Internet Gateway. Raising the hop limit does not "help you reach the internet." It only controls whether an extra on-host hop (a container bridge) can receive the IMDS reply.

Rule of thumb:

▸ Host / AL2023 default → 1

▸ Container that must read IMDS → 2

▸ EKS → keep 1 + IRSA / Pod Identity

One more thing worth saying out loud: the hop limit is a control over how credentials are STOLEN / forwarded off the node. It does nothing once the credentials are already off the box — stopping that replay is a different control (an IAM deny comparing aws:Ec2InstanceSourceVpc with aws:SourceVpc, which needs VPC endpoints). Both, not either.

Full write-up — diagram above plus the IMDSv2 token handshake, the replay defense, and trade-offs:

👉 https://kiquetal.dev/blog/2026-11-09-vpc-bound-instance-credentials

#AWS #CloudSecurity #IMDS #EC2 #EKS #Containers #DevSecOps #IAM #InfoSec

---
## ✅ READY TO POST — Español (copiar tal cual, mantener líneas en blanco)

"Poné el hop limit de IMDS en 1." Buen consejo — hasta que tu contenedor no puede leer sus credenciales y lo subís a 2 sin saber qué acabás de abrir. 🧵

El hop limit es un solo número, pero cuánto debería valer depende enteramente de tu topología. Acá está el cuadro completo. 👇

Primero, qué es realmente ese número:

La respuesta de IMDS sale del servicio de metadatos con su TTL IP fijado en el hop limit. Cada salto de red resta 1. El TTL llega a 0 → el paquete se descarta. Eso es todo. Es un guardarraíl de TTL que impide que la respuesta con las credenciales viaje fuera del host.

Ahora, por topología:

▸ Proceso en el host (EC2 directamente): 0 saltos extra. La respuesta sale con TTL 1 y llega con TTL 1. → Hop limit 1. Es el default seguro (y lo que fija Amazon Linux 2023).

▸ Contenedor en EC2 (Docker / ECS en EC2): el bridge docker0 agrega UN salto. Con límite 1, el TTL llega a 0 en el bridge y la respuesta se descarta — la llamada de tu contenedor a las credenciales se cuelga. → Necesitás hop limit 2, pero SOLO si el contenedor mismo lee IMDS.

▸ Pod de EKS: NO lo pongas en 2 por reflejo. El límite 2 deja que cualquier pod — o un SSRF dentro de cualquier pod — lea el rol de instancia del NODO worker. Eso es una ruta de escalamiento de privilegios. → Mantené el límite en 1 y dale al pod su PROPIA identidad con IRSA o EKS Pod Identity. El pod recibe un token proyectado y su propio rol IAM, y nunca toca las credenciales de IMDS del nodo.

Y el error que veo todo el tiempo:

▸ NAT / salida a internet NO tiene NADA que ver con el hop limit. IMDS es link-local (169.254.169.254) — nunca se enruta, nunca se NATea, nunca pasa por un Internet Gateway. Subir el hop limit no "te ayuda a llegar a internet". Solo controla si un salto extra dentro del host (un bridge de contenedor) puede recibir la respuesta de IMDS.

Regla práctica:

▸ Host / default de AL2023 → 1

▸ Contenedor que deba leer IMDS → 2

▸ EKS → mantené 1 + IRSA / Pod Identity

Una cosa más que vale la pena decir en voz alta: el hop limit es un control sobre cómo se ROBAN / reenvían las credenciales fuera del nodo. No hace nada una vez que las credenciales ya salieron de la máquina — frenar esa reutilización es otro control (un deny de IAM que compara aws:Ec2InstanceSourceVpc con aws:SourceVpc, y que necesita VPC endpoints). Los dos, no uno u otro.

Artículo completo — el diagrama de arriba más el handshake de token de IMDSv2, la defensa contra reutilización y los trade-offs:

👉 https://kiquetal.dev/blog/2026-11-09-vpc-bound-instance-credentials

#AWS #CloudSecurity #IMDS #EC2 #EKS #Containers #DevSecOps #IAM #InfoSec

---
## 🔎 Fact-check — verified against AWS documentation & community sources (2026-11-09)

Claims in the post, confirmed:

▸ **Hop limit = IP TTL on the response** — the response hop limit is the TTL; each network hop decrements it; the default is 1 and keeps the response on the instance. Confirmed by AWS IMDS docs and multiple hardening guides.

▸ **Container adds a hop → needs 2** — "in a container environment, if the hop limit is 1, the IMDSv2 response does not return because going to the container is considered an additional network hop." (StackOverflow / Convox / vendor docs.)

▸ **AL2023 default is 1** — Amazon Linux 2023 enforces IMDSv2 and sets the PUT response hop limit to 1 by default.

▸ **EKS best practice: keep 1 + per-pod identity** — the hop limit is a container decision; 1 keeps containers away from the node's role, 2 lets them reach it. The recommended pattern is IRSA / EKS Pod Identity so pods get their own role instead of the node's. (AWS EKS IMDSv2 support + hardening guides.)

▸ **IMDS is link-local, not internet-routed** — 169.254.0.0/16 is link-local; IMDS at 169.254.169.254 is reachable only from the instance and is never routed off-host. The hop limit therefore has no relationship to NAT/IGW internet egress.

Note: the replay defense (`aws:Ec2InstanceSourceVpc`) is covered in the companion
incident post — keep the two controls distinct: hop limit = theft/forwarding off
the node; condition key = replay of already-stolen creds.
