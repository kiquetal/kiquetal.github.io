---
title:
  en: 'SPIFFE on ECS with Envoy'
  es: 'SPIFFE en ECS con Envoy'
excerpt:
  en: 'TODO'
  es: 'TODO'
date: 2026-08-31
updated: 2026-09-04
tags: ['spiffe', 'spire', 'ecs', 'envoy', 'aws', 'security', 'mtls']
draft: true
---

<div class="lang-en">

I have been studying envoy for a while, because I was very satisfied with istio, but i wanted to know how it works under the hood.
The goal was very clear: implement a mTLS solution for ECS, a poor's version of zero trust.

We create the architecture using:

- SPIRE Server +  Admission Controller to allow/deny regiser in a service discovery
- SPIRE-Agent + Envoy sidecar to provide mTLS
- envoy sidecar to provide mTLS between services
- a custom `proteus_ecs` node attestor (two plugin halves: agent-side gathers the task claim, server-side verifies it against the ECS API) — because Fargate has no EC2 host for the usual `aws_iid` attestor


We have configured the envoy to go from service-a to service-b using mtls, for this goal we configured the envoy to use SDS (Secret Discovery Service) to get the SVIDs from SPIRE-Agent, and we configured the SPIRE-Agent to get the SVIDs from SPIRE-Server.

The admission controller is used to allow/deny the registration of the service in the service discovery, this is a very important step to avoid that a malicious service can register in the service discovery and get access to the other services.

## Architecture

Identity is established in two layers: first SPIRE decides which *task* it trusts (node attestation), then the admission controller decides which *service identity* that task is allowed to get (workload attestation).

![Proteus container view — SPIRE Server + Admission Controller task, and two service tasks each running app, Envoy sidecar (egress :9903 / ingress :9902) and SPIRE Agent](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-container.png)

### Node attestation — proving the ECS task

On Fargate there is no EC2 instance, so the usual `aws_iid` node attestor doesn't apply. I wrote a small custom node attestor, `proteus_ecs` — and like every SPIRE node attestor it comes in **two halves**: an *agent-side* plugin that gathers and sends the claim, and a *server-side* plugin that verifies it and decides whether to issue the node SVID. The agent side reads the task metadata endpoint and forwards the task ARN, cluster and family:

```go
metadataURI := os.Getenv("ECS_CONTAINER_METADATA_URI_V4")
body, _ := httpGet(metadataURI + "/task")   // TaskARN, Cluster, Family
```

The important part is on the **server side**: it never trusts the payload blindly. It calls the ECS API to confirm the task and checks the task's IAM role against an allow-list:

```go
taskInfo, _ := describeTask(ctx, region, cluster, payload.TaskARN) // ECS DescribeTasks
if !isRoleAllowed(taskInfo.TaskRoleARN) {
    return status.Error(codes.PermissionDenied, "task role not allowed")
}
// → spiffe://proteus.local/agent/ecs/<task-id>
//   selectors: ecs:cluster:*, ecs:family:*, ecs:task-role:*
```

So a task can *claim* an ARN, but the server verifies it out-of-band via `DescribeTasks` and only accepts pre-approved IAM roles.

![Node attestation sequence — the SPIRE Agent claims a task ARN; the SPIRE Server verifies it against the ECS API and an IAM-role allow-list before issuing a node SVID](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-node-attestation.png)

**How to read it:** the **SPIRE Agent** only *claims* an identity (it forwards the task ARN it read from metadata). The **SPIRE Server** is the trust anchor — it calls the **ECS API** (`DescribeTasks`) to confirm the task really exists and to fetch its IAM role, then checks that role against an allow-list. Only if the role passes does it mint the node SVID. This is why a compromised task can't forge an identity: the proof comes from AWS, not from the agent's own claim.

### Workload attestation + admission — proving the service

Node attestation says *which task*; the admission controller says *which service identity that task may hold*. On `POST /admit` it creates a SPIRE registration entry via the Entry API:

```go
spiffeID  := "spiffe://" + trustDomain + "/" + serviceName // e.g. .../service-a
selectors := []string{"unix:uid:1000"}
entryID, _ := spire.CreateEntry(ctx, parentID, spiffeID, selectors)
log.Printf("ADMITTED: service=%s spire_entry=%s", serviceName, entryID)
```

Until that entry exists, the agent has nothing to match and SDS returns `workload is not authorized` — this is the deny-by-default behavior the test below demonstrates. (The workload selector here is a coarse `unix:uid:1000`; tighter selectors are a natural next step.)

![Admission sequence — the admission controller creates a SPIRE registration entry so the agent's SDS request can be matched and a workload SVID issued](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-admission.png)

**How the two layers relate.** The `proteus_ecs` plugin and the admission controller answer two different questions, and a workload only gets a usable identity when both pass:

- **`proteus_ecs` plugin (node attestation)** — *is this really the ECS task it claims to be?* Its server-side half calls the ECS API (`DescribeTasks`) to verify the task and its IAM role, then issues a **node SVID** (`spiffe://proteus.local/agent/ecs/<task-id>`). Trust comes from AWS, not from the workload's own claim.
- **Admission controller (workload attestation)** — *is this task allowed to hold this service identity?* On `POST /admit` it creates a registration entry whose **`parentID` is exactly that node SVID**. That parent-child link is the seam: the controller can only grant a workload identity to a node the plugin already vouched for.

So the plugin establishes *infrastructure trust* (a genuine ECS task with an approved role); the admission controller layers *application policy* on top (this task may be `service-a`). Neither alone is enough — the SVID is minted only when the verified node has an admitted entry to match.

## Testing the architecture

The setup is intentionally minimal: two ECS services, `service-a` (the caller) and `service-b` (the callee), each with an Envoy sidecar and a co-located SPIRE Agent. `service-a` calls `service-b` over mTLS on `/api/data`. Both proxies fetch their identities from SPIRE via SDS.

The test walks through a **dark → admit → live** progression, proving that no workload receives an identity until it has been explicitly admitted.

![Dark by default vs live after admit — SDS denies the SVID until the admission controller creates the SPIRE entry](/blog/2026-08-31-spiffe-on-ecs-with-envoy/dark_vs_live.png)

The same story as a sequence: in the **dark** branch Envoy's SDS request is denied and the call fails with `503 UF`; in the **live** branch — after the admission controller creates the SPIRE entry — the SVID is pushed and the mTLS call to `service-b` succeeds.

![Proteus mTLS sequence — dark (SDS denied, 503 UF) vs live (SVID pushed, mTLS succeeds) after admission](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-mtls-dark-by-default-vs-live-after-admit.png)

### Step 1 — Dark state: no workload is admitted yet

Before any admission, Envoy asks SPIRE for an SVID and is rejected. The Envoy log on `service-a` shows the request failing with `503 flags=UF` and, underneath, the SDS stream being closed:

`workload is not authorized for the requested identities ["spiffe://proteus.local/service-a"]`

![Envoy on service-a denied — workload not authorized, 503 UF](/blog/2026-08-31-spiffe-on-ecs-with-envoy/svc-a-dark.png)

On the `service-b` side, the SPIRE Agent reports the same thing from its own perspective — an SDS `StreamSecrets` request for `spiffe://proteus.local/service-b` fails with `InvalidArgument: workload is not authorized`:

![SPIRE Agent on service-b denied — error building stream secrets](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-b-dark.png)

This is the whole point of the design: identity is deny-by-default.

> **What these logs actually prove.** The `workload is not authorized` errors are a *workload attestation* failure — there's no registration entry matching the requested SPIFFE ID yet. They are **not** node attestation. In fact, for the agent to reach this point it must have *already* node-attested successfully at startup (otherwise it couldn't talk to the Server at all). Node attestation happens first, almost immediately when the task boots; it just isn't what these dark-state screenshots capture. To see it directly you'd look at the agent/server startup logs where the node SVID (`spiffe://proteus.local/agent/ecs/<task-id>`) is issued.

### Step 2 — Admit service-a

The Admission Controller is what flips a workload from dark to allowed. Once it approves `service-a`, it logs the admission and the SPIRE registration entry it created:

`ADMITTED: microvm=service-a-task service=service-a spire_entry=6f842eda-9f2b-4f68-9bb8-ed514ec07937`

![Admission controller admits service-a and creates the SPIRE entry](/blog/2026-08-31-spiffe-on-ecs-with-envoy/admission-controller-allow-svc-a.png)

### Step 3 — service-a receives its SVID

With the entry in place, the SPIRE Agent on `service-a` creates the workload entry, mints the X.509 SVID, and streams it to Envoy over SDS:

`Entry created ... spiffe_id="spiffe://proteus.local/service-a"` → `Creating X509-SVID` → `Sending StreamSecrets response`

![SPIRE Agent on service-a creating the X509-SVID and streaming it via SDS](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-a-obtaining-cert.png)

### Step 4 — Admit service-b and issue its SVID

The same flow repeats for `service-b`. After it's admitted, its SPIRE Agent creates the entry, updates the SVID, and serves it to Envoy:

`Entry created ... spiffe://proteus.local/service-b` → `Creating X509-SVID` → `SVID updated`

![SPIRE Agent on service-b creating and updating the X509-SVID after admission](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-b-allowed.png)

### Step 5 — Live mTLS call succeeds

With both workloads holding valid SVIDs, the mTLS call goes through end to end.

On `service-a`, Envoy logs the outbound call succeeding:

`[mTLS-OUT] GET /api/data 200 upstream=10.0.0.141:9902`

![Envoy on service-a — successful mTLS-OUT call to service-b, HTTP 200](/blog/2026-08-31-spiffe-on-ecs-with-envoy/envoy-svc-a-calling-svc-b.png)

On `service-b`, Envoy logs the inbound call and — crucially — the verified peer identity from the client certificate:

`[mTLS-IN] GET /api/data 200 peer=spiffe://proteus.local/service-a`

![Envoy on service-b — inbound mTLS with verified peer SPIFFE ID service-a](/blog/2026-08-31-spiffe-on-ecs-with-envoy/envoy-svc-b-obtaining-cert-from-b.png)

The `peer=spiffe://proteus.local/service-a` field is the payoff: `service-b` didn't just accept a TLS connection, it cryptographically verified *who* was calling — no shared secret, no static cert, identity issued and rotated by SPIRE.






<!--
BRAINSTORM NOTES (remove before publishing)

## Why SPIFFE on ECS?
- Workload identity without long-lived secrets
- ECS tasks are ephemeral → need dynamic identity
- SPIFFE SVIDs (X.509) as the identity primitive
- Contrast with K8s post (SPIRE on K8s) — what's different on ECS?

## Architecture
- SPIRE Server (where? ECS service / EC2 / Fargate?)
- SPIRE Agent per ECS host (EC2 launch type) vs Fargate limitations
  - NOTE: Fargate has no host access → agent attestation challenge
  - Node attestation: aws_iid? aws_iam?
  - Workload attestation on ECS
- Envoy as sidecar in the task definition
- SDS (Secret Discovery Service) — Envoy pulls SVIDs from SPIRE via SDS

## The mTLS flow
1. ECS task starts, Envoy sidecar boots
2. Envoy connects to SPIRE Agent over Unix socket (SDS)
3. SPIRE issues X.509 SVID
4. Envoy uses SVID for mTLS between services
5. Rotation handled automatically by SPIRE

## Hard parts / gotchas
- Fargate vs EC2 launch type (agent placement)
- Unix domain socket sharing between containers in a task
- Trust domain setup
- SPIRE Server HA + datastore (RDS?)

## Diagrams needed (superdesign, vintage style)
- hero: SPIFFE + ECS + Envoy overview
- flow: SVID issuance + mTLS handshake sequence
- attestation: node + workload attestation on ECS

## Ties to certs
- AWS Security Specialty (identity, encryption in transit)
- CKAD/K8s SPIRE post as the counterpart

## Open questions
- Does anyone run SPIRE agent as a Fargate sidecar realistically?
- Comparison to AWS-native: ACM PCA + App Mesh mTLS?
- Why SPIFFE over App Mesh native mTLS?
-->

![Proteus C4 System Context — SPIFFE on ECS with Envoy](/blog/2026-08-31-spiffe-on-ecs-with-envoy/c4-context-en.png)

</div>

<div class="lang-es hidden">

Llevo un tiempo estudiando Envoy porque, aunque quedé muy satisfecho con Istio, quería entender cómo funciona por debajo.
El objetivo era claro: implementar una solución de mTLS para ECS, una versión "casera" de zero trust.

Construimos la arquitectura usando:

- SPIRE Server + Admission Controller para permitir/denegar el registro en el service discovery
- SPIRE-Agent + sidecar Envoy para proveer mTLS entre servicios
- un atestador de nodo propio `proteus_ecs` (dos mitades de plugin: el lado del agente reúne la afirmación de la tarea, el lado del servidor la verifica contra la API de ECS) — porque Fargate no tiene host EC2 para el atestador `aws_iid` habitual

Configuramos Envoy para ir de `service-a` a `service-b` usando mTLS; para ello configuramos Envoy para usar SDS (Secret Discovery Service) y obtener los SVIDs desde el SPIRE-Agent, y configuramos el SPIRE-Agent para obtener los SVIDs desde el SPIRE-Server.

El Admission Controller se usa para permitir/denegar el registro del servicio en el service discovery. Este paso es muy importante para evitar que un servicio malicioso se registre y obtenga acceso a los demás servicios.

## Arquitectura

La identidad se establece en dos capas: primero SPIRE decide en qué *tarea* confía (atestación de nodo) y luego el admission controller decide qué *identidad de servicio* puede obtener esa tarea (atestación de workload).

![Vista de contenedores de Proteus — tarea de SPIRE Server + Admission Controller, y dos tareas de servicio con app, sidecar Envoy (egress :9903 / ingress :9902) y SPIRE Agent](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-container.png)

### Atestación de nodo — probando la tarea ECS

En Fargate no hay una instancia EC2, así que el atestador de nodo habitual `aws_iid` no aplica. Escribí un atestador de nodo propio, `proteus_ecs` — y como todo atestador de nodo de SPIRE viene en **dos mitades**: un plugin del *lado del agente* que reúne y envía la afirmación, y un plugin del *lado del servidor* que la verifica y decide si emite el SVID de nodo. El lado del agente lee el endpoint de metadata de la tarea y reenvía el ARN de la tarea, el cluster y la family:

```go
metadataURI := os.Getenv("ECS_CONTAINER_METADATA_URI_V4")
body, _ := httpGet(metadataURI + "/task")   // TaskARN, Cluster, Family
```

Lo importante está en el **lado del servidor**: nunca confía en el payload a ciegas. Llama a la API de ECS para confirmar la tarea y verifica el rol IAM de la tarea contra una allow-list:

```go
taskInfo, _ := describeTask(ctx, region, cluster, payload.TaskARN) // ECS DescribeTasks
if !isRoleAllowed(taskInfo.TaskRoleARN) {
    return status.Error(codes.PermissionDenied, "task role not allowed")
}
// → spiffe://proteus.local/agent/ecs/<task-id>
//   selectors: ecs:cluster:*, ecs:family:*, ecs:task-role:*
```

Así, una tarea puede *afirmar* un ARN, pero el servidor lo verifica por fuera con `DescribeTasks` y solo acepta roles IAM previamente aprobados.

![Secuencia de atestación de nodo — el SPIRE Agent afirma un ARN de tarea; el SPIRE Server lo verifica contra la API de ECS y una lista de roles IAM permitidos antes de emitir el SVID de nodo](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-node-attestation.png)

**Cómo leerlo:** el **SPIRE Agent** solo *afirma* una identidad (reenvía el ARN de la tarea que leyó de la metadata). El **SPIRE Server** es el ancla de confianza — llama a la **API de ECS** (`DescribeTasks`) para confirmar que la tarea existe y obtener su rol IAM, y luego verifica ese rol contra una lista permitida. Solo si el rol pasa, emite el SVID de nodo. Por eso una tarea comprometida no puede falsificar una identidad: la prueba viene de AWS, no de la afirmación del agente.

### Atestación de workload + admisión — probando el servicio

La atestación de nodo dice *qué tarea*; el admission controller dice *qué identidad de servicio puede tener esa tarea*. En `POST /admit` crea una entrada de registro en SPIRE vía la Entry API:

```go
spiffeID  := "spiffe://" + trustDomain + "/" + serviceName // p.ej. .../service-a
selectors := []string{"unix:uid:1000"}
entryID, _ := spire.CreateEntry(ctx, parentID, spiffeID, selectors)
log.Printf("ADMITTED: service=%s spire_entry=%s", serviceName, entryID)
```

Hasta que esa entrada existe, el agente no tiene nada que coincidir y SDS devuelve `workload is not authorized` — este es el comportamiento denegado-por-defecto que demuestra la prueba de abajo. (El selector de workload aquí es un `unix:uid:1000` bastante amplio; selectores más estrictos son el siguiente paso natural.)

![Secuencia de admisión — el admission controller crea una entrada de registro en SPIRE para que la petición SDS del agente pueda coincidir y se emita un SVID de workload](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-admission.png)

**Cómo se relacionan las dos capas.** El plugin `proteus_ecs` y el admission controller responden dos preguntas distintas, y un workload solo obtiene una identidad usable cuando ambas pasan:

- **plugin `proteus_ecs` (atestación de nodo)** — *¿es realmente la tarea ECS que dice ser?* Su lado servidor llama a la API de ECS (`DescribeTasks`) para verificar la tarea y su rol IAM, y luego emite un **SVID de nodo** (`spiffe://proteus.local/agent/ecs/<task-id>`). La confianza viene de AWS, no de la afirmación del propio workload.
- **admission controller (atestación de workload)** — *¿puede esa tarea tener esta identidad de servicio?* En `POST /admit` crea una entrada de registro cuyo **`parentID` es exactamente ese SVID de nodo**. Ese enlace padre-hijo es la costura: el controller solo puede otorgar una identidad de workload a un nodo que el plugin ya avaló.

Así, el plugin establece la *confianza de infraestructura* (una tarea ECS genuina con un rol aprobado); el admission controller añade *política de aplicación* encima (esta tarea puede ser `service-a`). Ninguno basta por sí solo — el SVID se emite solo cuando el nodo verificado tiene una entrada admitida que coincida.

## Probando la arquitectura

El montaje es intencionalmente mínimo: dos servicios ECS, `service-a` (el invocador) y `service-b` (el que recibe), cada uno con un sidecar Envoy y un SPIRE Agent co-ubicado. `service-a` llama a `service-b` sobre mTLS en `/api/data`. Ambos proxies obtienen sus identidades desde SPIRE vía SDS.

La prueba recorre una progresión **oscuro → admitido → activo**, demostrando que ningún workload recibe una identidad hasta que ha sido admitido explícitamente.

![Oscuro por defecto vs activo tras la admisión — SDS deniega el SVID hasta que el admission controller crea la entrada en SPIRE](/blog/2026-08-31-spiffe-on-ecs-with-envoy/dark_vs_live.png)

La misma historia como secuencia: en la rama **oscura** la petición SDS de Envoy es denegada y la llamada falla con `503 UF`; en la rama **activa** — tras crear el admission controller la entrada en SPIRE — el SVID se entrega y la llamada mTLS a `service-b` tiene éxito.

![Secuencia mTLS de Proteus — oscuro (SDS denegado, 503 UF) vs activo (SVID entregado, mTLS exitoso) tras la admisión](/blog/2026-08-31-spiffe-on-ecs-with-envoy/proteus-mtls-dark-by-default-vs-live-after-admit.png)

### Paso 1 — Estado oscuro: ningún workload admitido todavía

Antes de cualquier admisión, Envoy le pide un SVID a SPIRE y es rechazado. El log de Envoy en `service-a` muestra la petición fallando con `503 flags=UF` y, debajo, el stream de SDS cerrándose:

`workload is not authorized for the requested identities ["spiffe://proteus.local/service-a"]`

![Envoy en service-a denegado — workload no autorizado, 503 UF](/blog/2026-08-31-spiffe-on-ecs-with-envoy/svc-a-dark.png)

Del lado de `service-b`, el SPIRE Agent reporta lo mismo desde su perspectiva — una petición SDS `StreamSecrets` para `spiffe://proteus.local/service-b` falla con `InvalidArgument: workload is not authorized`:

![SPIRE Agent en service-b denegado — error building stream secrets](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-b-dark.png)

Este es justamente el punto del diseño: la identidad es denegada por defecto.

> **Qué prueban realmente estos logs.** Los errores `workload is not authorized` son una falla de *atestación de workload* — todavía no existe una entrada de registro que coincida con el SPIFFE ID solicitado. **No** son atestación de nodo. De hecho, para que el agente llegue a este punto ya tuvo que haber hecho la atestación de nodo con éxito al arrancar (de lo contrario no podría ni hablar con el Server). La atestación de nodo ocurre primero, casi de inmediato al iniciar la tarea; simplemente no es lo que capturan estas capturas del estado oscuro. Para verla directamente mirarías los logs de arranque del agente/servidor donde se emite el SVID de nodo (`spiffe://proteus.local/agent/ecs/<task-id>`).

### Paso 2 — Admitir service-a

El Admission Controller es lo que hace pasar a un workload de oscuro a permitido. Una vez que aprueba `service-a`, registra la admisión y la entrada de registro que creó en SPIRE:

`ADMITTED: microvm=service-a-task service=service-a spire_entry=6f842eda-9f2b-4f68-9bb8-ed514ec07937`

![El admission controller admite service-a y crea la entrada en SPIRE](/blog/2026-08-31-spiffe-on-ecs-with-envoy/admission-controller-allow-svc-a.png)

### Paso 3 — service-a recibe su SVID

Con la entrada en su lugar, el SPIRE Agent en `service-a` crea la entrada del workload, emite el SVID X.509 y lo transmite a Envoy vía SDS:

`Entry created ... spiffe_id="spiffe://proteus.local/service-a"` → `Creating X509-SVID` → `Sending StreamSecrets response`

![SPIRE Agent en service-a creando el SVID X.509 y transmitiéndolo vía SDS](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-a-obtaining-cert.png)

### Paso 4 — Admitir service-b y emitir su SVID

El mismo flujo se repite para `service-b`. Tras ser admitido, su SPIRE Agent crea la entrada, actualiza el SVID y lo sirve a Envoy:

`Entry created ... spiffe://proteus.local/service-b` → `Creating X509-SVID` → `SVID updated`

![SPIRE Agent en service-b creando y actualizando el SVID X.509 tras la admisión](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-b-allowed.png)

### Paso 5 — La llamada mTLS en vivo tiene éxito

Con ambos workloads teniendo SVIDs válidos, la llamada mTLS pasa de extremo a extremo.

En `service-a`, Envoy registra la llamada saliente exitosa:

`[mTLS-OUT] GET /api/data 200 upstream=10.0.0.141:9902`

![Envoy en service-a — llamada mTLS-OUT exitosa a service-b, HTTP 200](/blog/2026-08-31-spiffe-on-ecs-with-envoy/envoy-svc-a-calling-svc-b.png)

En `service-b`, Envoy registra la llamada entrante y — lo más importante — la identidad del par verificada a partir del certificado de cliente:

`[mTLS-IN] GET /api/data 200 peer=spiffe://proteus.local/service-a`

![Envoy en service-b — mTLS entrante con SPIFFE ID del par verificado service-a](/blog/2026-08-31-spiffe-on-ecs-with-envoy/envoy-svc-b-obtaining-cert-from-b.png)

El campo `peer=spiffe://proteus.local/service-a` es la recompensa: `service-b` no solo aceptó una conexión TLS, sino que verificó criptográficamente *quién* estaba llamando — sin secreto compartido, sin certificado estático, con identidad emitida y rotada por SPIRE.

![Proteus C4 System Context — SPIFFE en ECS con Envoy](/blog/2026-08-31-spiffe-on-ecs-with-envoy/c4-context-en.png)

</div>
