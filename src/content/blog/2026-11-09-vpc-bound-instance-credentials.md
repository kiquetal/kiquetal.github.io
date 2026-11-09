---
title:
  en: 'Stolen EC2 Credentials, Replayed Off-Box: Why I Locked Instance Credentials to the VPC — and Why AWS Should Too'
  es: 'Credenciales EC2 Robadas y Reutilizadas Fuera de la Máquina: Por Qué Até las Credenciales de Instancia a la VPC — y Por Qué AWS Debería Hacerlo por Defecto'
excerpt:
  en: 'An attacker stole an EC2 instance role''s temporary IAM credentials and replayed them from their own laptop. IMDSv2 did not stop the replay — one IAM condition key, aws:Ec2InstanceSourceVpc, did. Here is the incident, why IMDSv2 is not enough, the trade-offs of VPC-binding credentials, and the question I keep asking AWS: why is this opt-in instead of the default?'
  es: 'Un atacante robó las credenciales IAM temporales del rol de una instancia EC2 y las reutilizó desde su propia laptop. IMDSv2 no detuvo la reutilización — una sola clave de condición de IAM, aws:Ec2InstanceSourceVpc, sí. Acá va el incidente, por qué IMDSv2 no alcanza, los trade-offs de atar las credenciales a la VPC, y la pregunta que no dejo de hacerle a AWS: ¿por qué esto es opt-in y no el comportamiento por defecto?'
date: 2026-11-09
updated: 2026-11-09
tags: ['aws', 'security', 'iam', 'imds', 'ec2', 'incident-response', 'devsecops', 'cloud-security']
draft: false
---

<div class="lang-en">

An attacker stole an EC2 instance's temporary AWS credentials and used them from
their own laptop. One IAM condition key shut that down completely. This post is
the incident, the control that actually worked, the trade-offs of that control,
and a question about AWS defaults I can't stop asking.

**Contents**

- [The incident in one picture](#the-incident)
- [What happened](#what-happened)
- [Why "just enforce IMDSv2" is not enough](#why-imdsv2)
- [How IMDSv2 actually works — and the hop limit](#imdsv2-hop-limit)
- [The control that worked: aws:Ec2InstanceSourceVpc](#the-control)
- [The implementation nuance that matters](#the-nuance)
- [Trade-offs: what VPC-binding costs you](#trade-offs)
- [Comparison: IMDSv2 vs the condition key](#comparison)
- [The question: why is this opt-in, not the default?](#the-question)
- [Fact-check & resources](#resources)

<a id="the-incident"></a>
## The incident in one picture

![Attack flow — a compromised EC2 instance reads temp role credentials from IMDS; the attacker exfiltrates them and replays them from an external IP outside the VPC; an IAM deny built on aws:Ec2InstanceSourceVpc blocks the off-box replay while legitimate in-VPC calls are allowed. A lower band contrasts where IMDSv2 acts (on stealing) vs where the condition key acts (on replay).](/blog/2026-11-09-vpc-bound-instance-credentials/attack-flow-vpc-bound.svg)

The short version: the credentials were stolen successfully. What saved us was
not stopping the theft — it was making the stolen credentials **worthless the
moment they left the network**.

<a id="what-happened"></a>
## What happened

Two steps, textbook pattern:

1. **Theft.** A compromised EC2 instance leaked its temporary IAM role
   credentials — the `ASIA…` STS keys that AWS vends through the Instance
   Metadata Service (IMDS) at `169.254.169.254`. Any code with execution on the
   box can read them.
2. **Replay.** The attacker took those keys and called the AWS API from an
   external, non-AWS IP — their own machine. This is the pattern GuardDuty
   labels `InstanceCredentialExfiltration.OutsideAWS`.

Temporary instance credentials are not short-lived enough to save you here. The
STS keys IMDS vends are valid for hours, and they are auto-rotated — so an
attacker who keeps reading IMDS keeps getting fresh keys. "They expire" is not a
defense.

<a id="why-imdsv2"></a>
## Why "just enforce IMDSv2" is not enough

The reflexive advice when instance credentials leak is "enforce IMDSv2." We had
IMDSv2. Here is the uncomfortable truth about what it does and does not do.

IMDSv2 changes how you *talk to the metadata endpoint*: it requires a
session token obtained with a `PUT` before any `GET`, and it enforces a hop
limit so a request bounced through a proxy (classic SSRF) can't reach IMDS. That
is real and worth having.

But look at where it acts in the diagram — it only raises the bar on **step (1),
stealing**:

- It blocks *simple SSRF* — the "trick the app into fetching the metadata URL"
  class of bug.
- It does **nothing** once an attacker has code execution on the instance. A web
  shell or an RCE can perform the `PUT` + `GET` dance exactly like the SDK does.
- It does **nothing** once the credentials are already off the box. The replay
  from the attacker's laptop in step (3) never touches IMDS at all.

So IMDSv2 is necessary, not sufficient. It narrows the ways credentials get
stolen. It does not touch the ways stolen credentials get *used*.

<a id="imdsv2-hop-limit"></a>
## How IMDSv2 actually works — and the hop limit

It's worth being precise about *how* IMDSv2 raises the bar, because the mechanism
is the reason it stops SSRF but nothing downstream.

![IMDSv2 explainer — Panel A shows the two-step handshake: a PUT to /latest/api/token returns a session token, then a GET to the credentials path carrying that token in the X-aws-ec2-metadata-token header returns the ASIA STS credentials. Panel B shows the hop limit as the IP TTL on the response packet: a legitimate direct read crosses zero extra hops so the TTL survives and the reply is delivered, while an SSRF bounced through a proxy or NAT crosses an extra hop, the TTL decrements to zero, and the reply is dropped before it reaches the attacker.](/blog/2026-11-09-vpc-bound-instance-credentials/imdsv2-hop-limit.svg)

**The token handshake.** IMDSv1 answered a single unauthenticated `GET`. IMDSv2
requires two steps:

1. `PUT /latest/api/token` → IMDS returns a session token (TTL up to 6 hours).
2. `GET /latest/meta-data/iam/security-credentials/<role>` **with** that token in
   the `X-aws-ec2-metadata-token` header → IMDS returns the credentials.

A reflected-URL SSRF (where you trick an app into fetching an attacker-supplied
URL) can usually only do a blind `GET`. It can't do the `PUT`-first dance, and a
`GET` without the token header fails. That single change kills the classic
"fetch `http://169.254.169.254/...`" SSRF.

**The hop limit.** This is the part people set and forget without understanding.
The IMDS *response* leaves the metadata service with its IP **TTL** set to the
configured hop limit (default `1`). Every network hop the packet crosses
decrements TTL by one; when TTL hits `0`, the packet is dropped.

- An app reading IMDS **directly** on the instance crosses zero extra hops — the
  reply arrives with TTL still positive and is delivered. ✅
- An SSRF that bounces the request **through a proxy, NAT, or an extra network
  boundary** forces the reply across one more hop. With hop limit `1`, TTL
  decrements to `0` at that hop and the reply is **dropped before it reaches the
  attacker**. ❌

Practical guidance: set the hop limit to `1` for workloads that read IMDS
directly. Containers whose traffic routes through the host network namespace
sometimes need `2` — set it as low as your topology allows, and no lower.

### Hop count by topology

The right hop-limit value depends entirely on how many network hops sit between
the thing reading IMDS and the metadata service. Here are the cases that come up
in practice:

![IMDS hop limit by topology — four scenarios. (1) A process on the host reads IMDS across zero extra hops, so hop limit 1 works. (2) A Docker/ECS container on EC2 adds one hop at the docker0 bridge, so with limit 1 the reply's TTL reaches zero at the bridge and is dropped, while limit 2 is needed for the reply to reach the container. (3) An EKS pod should keep limit 1 so pods cannot reach the node role; the correct fix for pods that need AWS credentials is per-pod identity via IRSA or EKS Pod Identity, not raising the hop limit. (4) NAT and internet egress are a separate path: IMDS is link-local at 169.254.169.254 and is never routed, NAT'd, or sent to the internet, so the hop limit has nothing to do with reaching the internet.](/blog/2026-11-09-vpc-bound-instance-credentials/imds-hop-limit-topologies.svg)

- **Process on the host (EC2 directly).** Zero extra hops — the reply leaves IMDS
  with TTL `1` and arrives with TTL `1`. **Hop limit `1`.** This is the secure
  default (and what Amazon Linux 2023 sets).
- **Container on EC2 (Docker / ECS on EC2).** The packet crosses one extra hop at
  the `docker0` bridge (the veth/NAT boundary into the container network). With
  hop limit `1`, TTL decrements to `0` at the bridge and the reply is dropped;
  the container's IMDS call hangs. **Hop limit `2`** is required — but only if
  the container itself needs to read IMDS.
- **EKS pod.** Don't reflexively raise the limit to `2`. Doing so lets *any* pod
  — or an SSRF inside any pod — read the **worker node's** instance role, which
  is a privilege-escalation path (a pod should not inherit the node's AWS
  permissions). Keep the hop limit at `1` and give the pod its **own** identity
  with **IRSA** or **EKS Pod Identity**: the pod receives a projected token and
  assumes its own IAM role, never touching the node's IMDS credentials.
- **NAT / internet egress (common misconception).** Raising the hop limit does
  **not** "help you reach the internet." IMDS lives at the link-local address
  `169.254.169.254` — it is never routed, never NAT'd, never sent through an
  Internet Gateway. Internet egress (instance → NAT Gateway → IGW → internet) is
  a completely separate path that the hop limit does not touch. The hop limit
  only governs whether an extra *on-host* hop (like a container bridge) can
  receive the IMDS reply.

Rule of thumb: host / AL2023 default is `1`; a container that must read IMDS
needs `2`; on EKS keep `1` and use IRSA / Pod Identity.

The crucial caveat, and the bridge to the rest of this post: **the hop limit is
an SSRF / exfil-path control, not a replay control.** It governs whether a packet
can *leave* toward the metadata endpoint on the box. Once the credentials are
already off the box — in the attacker's hands on their own machine — the hop
limit is irrelevant. That gap is exactly what the next section closes.

<a id="the-control"></a>
## The control that worked: aws:Ec2InstanceSourceVpc

What actually neutralized the replay was an IAM deny built on one condition key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInstanceCredsUsedOutsideTheirVpc",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:Ec2InstanceSourceVpc": "vpc-0abc123456789def0"
        },
        "Null": {
          "aws:Ec2InstanceSourceVpc": "false"
        }
      }
    }
  ]
}
```

Read it as: *"If these are EC2 instance credentials (the key is present) and the
request's source VPC is not the VPC that issued them, deny everything."*

`aws:Ec2InstanceSourceVpc` carries the VPC ID of the VPC in which the instance
that was issued the credentials runs. AWS populates it **automatically on every
credential issued to an EC2 instance** — you don't configure the instance to
emit it. When the attacker replayed the keys from outside that VPC, the source
VPC no longer matched, the deny fired, and **every call was blocked**. The
stolen keys became worthless the moment they left the network.

The two `Condition` operators matter:

- `StringNotEquals` — deny when the source VPC is anything other than the
  issuing VPC.
- `Null: "false"` — only apply this deny when the key *exists*. Without it, the
  policy would also deny credentials that aren't EC2 instance credentials at all
  (users, other roles), because the key would be absent and "absent ≠ my VPC"
  evaluates true. This guard scopes the deny to instance credentials only.

<a id="the-nuance"></a>
## The implementation nuance that matters

There are three similar-looking condition keys, and picking the wrong one
silently does nothing:

- `aws:SourceVpc` and `aws:SourceVpce` only populate for traffic that arrives
  **over a VPC endpoint (PrivateLink)**. If your workload calls public AWS API
  endpoints — which most do by default — these keys are simply absent, your
  condition never matches the way you expect, and you get a false sense of
  protection. They describe the *network path of this request*, not the
  credential.
- `aws:Ec2InstanceSourceVpc` is bound to the **instance credential itself** and
  populates regardless of the network path. That is exactly why it was the right
  key for an off-box replay: it does not care whether the attacker went through
  an endpoint or the public internet — it only cares which VPC issued the keys.

There is a sibling key, `aws:Ec2InstanceSourcePrivateIPv4`, that carries the
instance's primary private IP. You can layer it on to pin credentials to a
single instance's IP, but VPC-level binding was the right blast radius for this
incident.

<a id="trade-offs"></a>
## Trade-offs: what VPC-binding costs you

This is not free, and it is not right for every workload. Honest trade-offs:

- **Legitimate off-box use breaks too.** If any real workflow uses instance
  credentials from outside the issuing VPC — cross-VPC without PrivateLink, an
  on-prem job assuming the instance role, a CI runner — this deny breaks it. The
  control cannot tell "attacker off-box" from "my pipeline off-box." You must
  inventory those paths first.
- **Multi-VPC / multi-account needs a set, not a single value.** A fleet spread
  across several VPCs needs the condition to allow a *list* of VPC IDs (or be
  applied per-VPC via SCP/boundary). That list becomes config you have to keep
  in sync as VPCs are created and retired.
- **VPC peering and Transit Gateway don't change the issuing VPC.** The key
  reflects the VPC that *issued* the credential, not reachability. Traffic that
  rides a peering connection from another VPC still carries that other VPC's
  source, so it is denied — which is usually what you want, but surprises teams
  who think "peered = same network."
- **It is a deny, so debugging is a cliff.** When it misfires, calls fail with
  `AccessDenied` and no hint about *why*. Wire up CloudTrail and a dashboard for
  the deny before you roll it out, or you'll burn an afternoon.
- **Placement matters.** As an SCP it covers a whole OU but can't name a single
  VPC cleanly across accounts; as a role trust/permission boundary it is precise
  but must be attached to every role. Pick the layer deliberately.

Despite all that, for the common case — an instance role used only by the
instance, inside its own VPC — the downside is close to zero and the upside is
that off-box replay simply stops working.

<a id="comparison"></a>
## Comparison: IMDSv2 vs the condition key

| Aspect | IMDSv2 | `aws:Ec2InstanceSourceVpc` deny |
|--------|--------|--------------------------------|
| **What it protects** | How credentials are *stolen* | How stolen credentials are *used* |
| **Stops simple SSRF** | ✅ Yes | ➖ N/A (not its job) |
| **Stops theft after code execution (RCE/web shell)** | ❌ No | ➖ N/A |
| **Stops off-box replay (step 3)** | ❌ No | ✅ Yes |
| **Depends on network path** | ❌ No | ✅ No (bound to credential) |
| **Config effort** | Instance / launch-template setting | IAM policy / SCP authored by you |
| **Breaks legit off-box use** | No | ⚠️ Yes — must inventory first |
| **Default in AWS?** | Now default on new instances | ❌ Opt-in only |

The row that matters: these controls act in **different places**. IMDSv2 is
upstream (theft), the condition key is downstream (use). You want both. They are
not substitutes.

<a id="the-question"></a>
## The question: why is this opt-in, not the default?

Here is what bothers me. AWS **already knows** which VPC issued the credential —
that's the whole reason the key can exist and be auto-populated. The information
is right there in the request context on every single call.

So why are instance-role credentials not VPC-bound **by default**?

Making off-box replay fail by default would eliminate the
`InstanceCredentialExfiltration.OutsideAWS` class of attack for the vast majority
of workloads, where the instance role is only ever used by the instance anyway.
The downside for that majority is essentially zero. Instead it ships as an
opt-in condition key launched in March 2023 that most teams have never heard of.

I understand the counter-argument — a hard default would break the minority of
workloads that legitimately use instance credentials off-box, and AWS is
allergic to breaking changes. But "secure by default with a documented opt-out"
is a posture AWS has adopted before (IMDSv2 itself is now default on new
instances; S3 Block Public Access; EBS encryption by default). Credential
VPC-binding feels like it belongs in that same category.

Why is this opt-in instead of opt-out, AWS?

<a id="resources"></a>
## Fact-check & resources

Every technical claim here is verified against AWS documentation:

- The keys `aws:EC2InstanceSourceVPC` (VPC ID) and
  `aws:EC2InstanceSourcePrivateIPv4` (primary private IPv4) launched
  **2023-03-06**, in all Regions including GovCloud and China, at no extra
  charge — [AWS What's New: IAM Roles for Amazon EC2 credential control properties](https://aws.amazon.com/about-aws/whats-new/2023/03/iam-roles-amazon-ec2-credential-control-properties/)
- Purpose and how to author the policies — [AWS Security Blog: How to use policies to restrict where EC2 instance credentials can be used from](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)
- `aws:SourceVpc` populating only for VPC-endpoint traffic — [AWS global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- Detection can be bypassed via VPC endpoints, which is why the IAM deny matters — [hackingthe.cloud: Bypass Credential Exfiltration Detection](https://hackingthe.cloud/aws/avoiding-detection/steal-keys-undetected/)

Casing note: AWS docs write the key as `aws:EC2InstanceSourceVPC`. IAM
condition-key matching is case-insensitive, so `aws:Ec2InstanceSourceVpc` (used
in the policy above) is equivalent and valid.

*No account IDs, instance IDs, attacker IPs, or access keys appear in this
post — the VPC ID above is a placeholder. Incident specifics stay in the private
report.*

</div>

<div class="lang-es hidden">

Un atacante robó las credenciales AWS temporales de una instancia EC2 y las usó
desde su propia laptop. Una sola clave de condición de IAM cortó eso por
completo. Este post es el incidente, el control que realmente funcionó, los
trade-offs de ese control, y una pregunta sobre los valores por defecto de AWS
que no dejo de hacerme.

**Contenidos**

- [El incidente en una imagen](#el-incidente)
- [Qué pasó](#que-paso)
- [Por qué "solo aplicá IMDSv2" no alcanza](#por-que-imdsv2)
- [Cómo funciona IMDSv2 en realidad — y el hop limit](#imdsv2-hop-limit-es)
- [El control que funcionó: aws:Ec2InstanceSourceVpc](#el-control)
- [El matiz de implementación que importa](#el-matiz)
- [Trade-offs: qué te cuesta atar a la VPC](#trade-offs-es)
- [Comparación: IMDSv2 vs la clave de condición](#comparacion)
- [La pregunta: ¿por qué es opt-in y no el comportamiento por defecto?](#la-pregunta)
- [Verificación y recursos](#recursos)

<a id="el-incidente"></a>
## El incidente en una imagen

![Flujo de ataque — una instancia EC2 comprometida lee credenciales temporales del rol desde IMDS; el atacante las exfiltra y las reutiliza desde una IP externa fuera de la VPC; un deny de IAM construido sobre aws:Ec2InstanceSourceVpc bloquea la reutilización fuera de la máquina mientras las llamadas legítimas dentro de la VPC quedan permitidas. Una banda inferior contrasta dónde actúa IMDSv2 (sobre el robo) vs dónde actúa la clave de condición (sobre la reutilización).](/blog/2026-11-09-vpc-bound-instance-credentials/attack-flow-vpc-bound.svg)

La versión corta: las credenciales se robaron con éxito. Lo que nos salvó no fue
impedir el robo — fue hacer que las credenciales robadas quedaran **inútiles en
el momento en que salieron de la red**.

<a id="que-paso"></a>
## Qué pasó

Dos pasos, patrón de manual:

1. **Robo.** Una instancia EC2 comprometida filtró las credenciales temporales
   de su rol de IAM — las claves STS tipo `ASIA…` que AWS entrega a través del
   Instance Metadata Service (IMDS) en `169.254.169.254`. Cualquier código con
   ejecución en la máquina puede leerlas.
2. **Reutilización.** El atacante tomó esas claves y llamó a la API de AWS desde
   una IP externa, fuera de AWS — su propia máquina. Este es el patrón que
   GuardDuty etiqueta como `InstanceCredentialExfiltration.OutsideAWS`.

Las credenciales temporales de instancia no son lo bastante efímeras como para
salvarte acá. Las claves STS que entrega IMDS son válidas por horas y se rotan
automáticamente — así que un atacante que sigue leyendo IMDS sigue obteniendo
claves frescas. "Expiran" no es una defensa.

<a id="por-que-imdsv2"></a>
## Por qué "solo aplicá IMDSv2" no alcanza

El consejo reflejo cuando se filtran credenciales de instancia es "aplicá
IMDSv2". Nosotros teníamos IMDSv2. Esta es la verdad incómoda sobre lo que hace
y lo que no hace.

IMDSv2 cambia cómo *hablás con el endpoint de metadatos*: requiere un token de
sesión obtenido con un `PUT` antes de cualquier `GET`, y aplica un límite de
saltos (hop limit) para que una solicitud rebotada por un proxy (el SSRF
clásico) no pueda alcanzar IMDS. Eso es real y vale la pena tenerlo.

Pero mirá dónde actúa en el diagrama — solo eleva la barrera en el **paso (1),
el robo**:

- Bloquea el *SSRF simple* — la clase de bug "engañá a la app para que busque la
  URL de metadatos".
- No hace **nada** una vez que el atacante tiene ejecución de código en la
  instancia. Un web shell o un RCE puede hacer el baile `PUT` + `GET` igual que
  el SDK.
- No hace **nada** una vez que las credenciales ya salieron de la máquina. La
  reutilización desde la laptop del atacante en el paso (3) nunca toca IMDS.

Así que IMDSv2 es necesario, no suficiente. Reduce las formas en que las
credenciales se roban. No toca las formas en que las credenciales robadas se
*usan*.

<a id="imdsv2-hop-limit-es"></a>
## Cómo funciona IMDSv2 en realidad — y el hop limit

Vale la pena ser preciso sobre *cómo* IMDSv2 eleva la barrera, porque el
mecanismo es la razón por la que frena el SSRF pero nada aguas abajo.

![Explicación de IMDSv2 — El panel A muestra el handshake de dos pasos: un PUT a /latest/api/token devuelve un token de sesión, luego un GET a la ruta de credenciales llevando ese token en el header X-aws-ec2-metadata-token devuelve las credenciales STS ASIA. El panel B muestra el hop limit como el TTL IP del paquete de respuesta: una lectura directa legítima no cruza saltos extra, así que el TTL sobrevive y la respuesta se entrega, mientras que un SSRF rebotado por un proxy o NAT cruza un salto extra, el TTL llega a cero y la respuesta se descarta antes de llegar al atacante.](/blog/2026-11-09-vpc-bound-instance-credentials/imdsv2-hop-limit.svg)

**El handshake del token.** IMDSv1 respondía a un único `GET` sin autenticar.
IMDSv2 requiere dos pasos:

1. `PUT /latest/api/token` → IMDS devuelve un token de sesión (TTL hasta 6 horas).
2. `GET /latest/meta-data/iam/security-credentials/<rol>` **con** ese token en el
   header `X-aws-ec2-metadata-token` → IMDS devuelve las credenciales.

Un SSRF de URL reflejada (donde engañás a una app para que busque una URL
provista por el atacante) normalmente solo puede hacer un `GET` a ciegas. No
puede hacer el baile del `PUT` primero, y un `GET` sin el header del token
falla. Ese único cambio mata el SSRF clásico de "buscar
`http://169.254.169.254/...`".

**El hop limit.** Esta es la parte que la gente configura y olvida sin entender.
La *respuesta* de IMDS sale del servicio de metadatos con su **TTL** IP fijado en
el hop limit configurado (por defecto `1`). Cada salto de red que cruza el
paquete decrementa el TTL en uno; cuando el TTL llega a `0`, el paquete se
descarta.

- Una app que lee IMDS **directamente** en la instancia cruza cero saltos extra —
  la respuesta llega con el TTL todavía positivo y se entrega. ✅
- Un SSRF que rebota la solicitud **a través de un proxy, NAT o un límite de red
  extra** fuerza a la respuesta a cruzar un salto más. Con hop limit `1`, el TTL
  decrementa a `0` en ese salto y la respuesta se **descarta antes de llegar al
  atacante**. ❌

Guía práctica: fijá el hop limit en `1` para cargas que leen IMDS directamente.
Los contenedores cuyo tráfico se enruta por el namespace de red del host a veces
necesitan `2` — ponelo tan bajo como tu topología permita, y no más bajo.

### Conteo de saltos por topología

El valor correcto del hop limit depende enteramente de cuántos saltos de red hay
entre lo que lee IMDS y el servicio de metadatos. Los casos que aparecen en la
práctica:

![Hop limit de IMDS por topología — cuatro escenarios. (1) Un proceso en el host lee IMDS sin saltos extra, así que hop limit 1 funciona. (2) Un contenedor Docker/ECS en EC2 agrega un salto en el bridge docker0, así que con límite 1 el TTL de la respuesta llega a cero en el bridge y se descarta, mientras que se necesita límite 2 para que la respuesta llegue al contenedor. (3) Un pod de EKS debería mantener límite 1 para que los pods no puedan alcanzar el rol del nodo; la solución correcta para pods que necesitan credenciales AWS es identidad por pod vía IRSA o EKS Pod Identity, no subir el hop limit. (4) NAT y la salida a internet son una ruta separada: IMDS es link-local en 169.254.169.254 y nunca se enruta, se NATea ni se envía a internet, así que el hop limit no tiene nada que ver con llegar a internet.](/blog/2026-11-09-vpc-bound-instance-credentials/imds-hop-limit-topologies.svg)

- **Proceso en el host (EC2 directamente).** Cero saltos extra — la respuesta
  sale de IMDS con TTL `1` y llega con TTL `1`. **Hop limit `1`.** Es el default
  seguro (y lo que fija Amazon Linux 2023).
- **Contenedor en EC2 (Docker / ECS en EC2).** El paquete cruza un salto extra en
  el bridge `docker0` (el límite veth/NAT hacia la red del contenedor). Con hop
  limit `1`, el TTL decrementa a `0` en el bridge y la respuesta se descarta; la
  llamada del contenedor a IMDS se cuelga. Se requiere **hop limit `2`** — pero
  solo si el contenedor mismo necesita leer IMDS.
- **Pod de EKS.** No subas el límite a `2` por reflejo. Hacerlo deja que
  *cualquier* pod — o un SSRF dentro de cualquier pod — lea el rol de instancia
  del **nodo worker**, lo que es una ruta de escalamiento de privilegios (un pod
  no debería heredar los permisos AWS del nodo). Mantené el hop limit en `1` y
  dale al pod su **propia** identidad con **IRSA** o **EKS Pod Identity**: el pod
  recibe un token proyectado y asume su propio rol IAM, sin tocar nunca las
  credenciales de IMDS del nodo.
- **NAT / salida a internet (error común).** Subir el hop limit **no** "te ayuda
  a llegar a internet". IMDS vive en la dirección link-local `169.254.169.254` —
  nunca se enruta, nunca se NATea, nunca pasa por un Internet Gateway. La salida
  a internet (instancia → NAT Gateway → IGW → internet) es una ruta
  completamente separada que el hop limit no toca. El hop limit solo rige si un
  salto extra *dentro del host* (como un bridge de contenedor) puede recibir la
  respuesta de IMDS.

Regla práctica: host / default de AL2023 es `1`; un contenedor que deba leer IMDS
necesita `2`; en EKS mantené `1` y usá IRSA / Pod Identity.

La advertencia crucial, y el puente al resto del post: **el hop limit es un
control de SSRF / ruta de exfiltración, no un control de reutilización.** Rige si
un paquete puede *salir* hacia el endpoint de metadatos en la máquina. Una vez
que las credenciales ya salieron de la máquina — en manos del atacante en su
propia máquina — el hop limit es irrelevante. Ese hueco es exactamente lo que
cierra la siguiente sección.

<a id="el-control"></a>
## El control que funcionó: aws:Ec2InstanceSourceVpc

Lo que realmente neutralizó la reutilización fue un deny de IAM construido sobre
una sola clave de condición:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInstanceCredsUsedOutsideTheirVpc",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:Ec2InstanceSourceVpc": "vpc-0abc123456789def0"
        },
        "Null": {
          "aws:Ec2InstanceSourceVpc": "false"
        }
      }
    }
  ]
}
```

Se lee así: *"Si estas son credenciales de instancia EC2 (la clave está
presente) y la VPC de origen de la solicitud no es la VPC que las emitió, denegá
todo."*

`aws:Ec2InstanceSourceVpc` lleva el ID de la VPC en la que corre la instancia a
la que se emitieron las credenciales. AWS lo completa **automáticamente en cada
credencial emitida a una instancia EC2** — no configurás la instancia para que
lo emita. Cuando el atacante reutilizó las claves desde fuera de esa VPC, la VPC
de origen ya no coincidía, el deny se disparó, y **toda llamada quedó
bloqueada**. Las claves robadas quedaron inútiles en el momento en que salieron
de la red.

Los dos operadores de `Condition` importan:

- `StringNotEquals` — denegá cuando la VPC de origen sea distinta a la VPC
  emisora.
- `Null: "false"` — aplicá este deny solo cuando la clave *exista*. Sin esto, la
  política también denegaría credenciales que no son de instancia EC2 (usuarios,
  otros roles), porque la clave estaría ausente y "ausente ≠ mi VPC" evalúa como
  verdadero. Este guard limita el deny únicamente a credenciales de instancia.

<a id="el-matiz"></a>
## El matiz de implementación que importa

Hay tres claves de condición que se parecen, y elegir la equivocada no hace nada
en silencio:

- `aws:SourceVpc` y `aws:SourceVpce` solo se completan para tráfico que llega
  **a través de un VPC endpoint (PrivateLink)**. Si tu carga de trabajo llama a
  los endpoints públicos de la API de AWS — como hacen la mayoría por defecto —
  estas claves simplemente no están, tu condición nunca coincide como esperás, y
  te da una falsa sensación de protección. Describen la *ruta de red de esta
  solicitud*, no la credencial.
- `aws:Ec2InstanceSourceVpc` está ligada a la **credencial de instancia misma**
  y se completa sin importar la ruta de red. Por eso fue la clave correcta para
  una reutilización fuera de la máquina: no le importa si el atacante pasó por
  un endpoint o por la internet pública — solo le importa qué VPC emitió las
  claves.

Existe una clave hermana, `aws:Ec2InstanceSourcePrivateIPv4`, que lleva la IP
privada primaria de la instancia. Podés sumarla para fijar las credenciales a la
IP de una sola instancia, pero el binding a nivel VPC fue el radio de impacto
correcto para este incidente.

<a id="trade-offs-es"></a>
## Trade-offs: qué te cuesta atar a la VPC

Esto no es gratis, y no es apropiado para toda carga de trabajo. Trade-offs
honestos:

- **El uso legítimo fuera de la máquina también se rompe.** Si algún flujo real
  usa credenciales de instancia desde fuera de la VPC emisora — cross-VPC sin
  PrivateLink, un job on-prem asumiendo el rol de la instancia, un runner de CI —
  este deny lo rompe. El control no distingue "atacante fuera de la máquina" de
  "mi pipeline fuera de la máquina". Primero tenés que inventariar esas rutas.
- **Multi-VPC / multi-cuenta necesita un conjunto, no un valor único.** Una
  flota repartida en varias VPCs necesita que la condición permita una *lista*
  de IDs de VPC (o aplicarse por VPC vía SCP/boundary). Esa lista se vuelve
  configuración que hay que mantener sincronizada a medida que se crean y retiran
  VPCs.
- **VPC peering y Transit Gateway no cambian la VPC emisora.** La clave refleja
  la VPC que *emitió* la credencial, no la alcanzabilidad. El tráfico que viaja
  por una conexión de peering desde otra VPC sigue llevando el origen de esa
  otra VPC, así que se deniega — que suele ser lo que querés, pero sorprende a
  equipos que piensan "peered = misma red".
- **Es un deny, así que debuguear es un precipicio.** Cuando falla, las llamadas
  fallan con `AccessDenied` y sin pista del *por qué*. Conectá CloudTrail y un
  dashboard para el deny antes de desplegarlo, o vas a quemar una tarde.
- **La ubicación importa.** Como SCP cubre toda una OU pero no puede nombrar una
  sola VPC limpiamente entre cuentas; como trust/boundary de rol es preciso pero
  hay que adjuntarlo a cada rol. Elegí la capa con intención.

A pesar de todo eso, para el caso común — un rol de instancia usado solo por la
instancia, dentro de su propia VPC — la desventaja es casi cero y la ventaja es
que la reutilización fuera de la máquina simplemente deja de funcionar.

<a id="comparacion"></a>
## Comparación: IMDSv2 vs la clave de condición

| Aspecto | IMDSv2 | Deny con `aws:Ec2InstanceSourceVpc` |
|--------|--------|--------------------------------|
| **Qué protege** | Cómo se *roban* las credenciales | Cómo se *usan* las credenciales robadas |
| **Frena el SSRF simple** | ✅ Sí | ➖ N/A (no es su trabajo) |
| **Frena el robo tras ejecución de código (RCE/web shell)** | ❌ No | ➖ N/A |
| **Frena la reutilización fuera de la máquina (paso 3)** | ❌ No | ✅ Sí |
| **Depende de la ruta de red** | ❌ No | ✅ No (ligada a la credencial) |
| **Esfuerzo de configuración** | Ajuste de instancia / launch template | Política IAM / SCP que escribís vos |
| **Rompe el uso legítimo fuera de la máquina** | No | ⚠️ Sí — primero inventariá |
| **¿Por defecto en AWS?** | Ahora por defecto en instancias nuevas | ❌ Solo opt-in |

La fila que importa: estos controles actúan en **lugares distintos**. IMDSv2 es
aguas arriba (robo), la clave de condición es aguas abajo (uso). Querés las dos.
No son sustitutos.

<a id="la-pregunta"></a>
## La pregunta: ¿por qué es opt-in y no el comportamiento por defecto?

Esto es lo que me molesta. AWS **ya sabe** qué VPC emitió la credencial — es la
razón misma por la que la clave puede existir y completarse automáticamente. La
información está ahí, en el contexto de la solicitud, en cada llamada.

Entonces, ¿por qué las credenciales del rol de instancia no están ligadas a la
VPC **por defecto**?

Hacer que la reutilización fuera de la máquina falle por defecto eliminaría la
clase de ataque `InstanceCredentialExfiltration.OutsideAWS` para la gran mayoría
de las cargas de trabajo, donde el rol de instancia solo lo usa la instancia de
todas formas. La desventaja para esa mayoría es prácticamente cero. En cambio se
entrega como una clave de condición opt-in, lanzada en marzo de 2023, de la que
la mayoría de los equipos nunca escuchó.

Entiendo el contraargumento — un default duro rompería la minoría de cargas que
legítimamente usan credenciales de instancia fuera de la máquina, y AWS le tiene
alergia a los breaking changes. Pero "seguro por defecto con un opt-out
documentado" es una postura que AWS ya adoptó antes (el propio IMDSv2 ahora es
default en instancias nuevas; S3 Block Public Access; cifrado de EBS por
defecto). El binding de credenciales a la VPC parece pertenecer a esa misma
categoría.

¿Por qué es opt-in en lugar de opt-out, AWS?

<a id="recursos"></a>
## Verificación y recursos

Cada afirmación técnica acá está verificada contra la documentación de AWS:

- Las claves `aws:EC2InstanceSourceVPC` (ID de VPC) y
  `aws:EC2InstanceSourcePrivateIPv4` (IPv4 privada primaria) se lanzaron el
  **2023-03-06**, en todas las Regiones incluyendo GovCloud y China, sin costo
  extra — [AWS What's New: IAM Roles for Amazon EC2 credential control properties](https://aws.amazon.com/about-aws/whats-new/2023/03/iam-roles-amazon-ec2-credential-control-properties/)
- Propósito y cómo escribir las políticas — [AWS Security Blog: How to use policies to restrict where EC2 instance credentials can be used from](https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/)
- `aws:SourceVpc` se completa solo para tráfico por VPC endpoint — [AWS global condition context keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html)
- La detección puede evadirse vía VPC endpoints, por eso importa el deny de IAM — [hackingthe.cloud: Bypass Credential Exfiltration Detection](https://hackingthe.cloud/aws/avoiding-detection/steal-keys-undetected/)

Nota sobre el casing: los docs de AWS escriben la clave como
`aws:EC2InstanceSourceVPC`. La coincidencia de claves de condición de IAM es
case-insensitive, así que `aws:Ec2InstanceSourceVpc` (usada en la política de
arriba) es equivalente y válida.

*No aparecen IDs de cuenta, IDs de instancia, IPs del atacante ni claves de
acceso en este post — el ID de VPC de arriba es un placeholder. Los detalles del
incidente quedan en el reporte privado.*

</div>
