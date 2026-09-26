---
title:
  en: 'ECS Attestation in Proteus: Why Custom Plugins Beat Pre-Shared Tokens on Fargate'
  es: 'Atestación ECS en Proteus: Por Qué Los Plugins Personalizados Superan Los Tokens Pre-Compartidos en Fargate'
excerpt:
  en: 'Why SPIRE''s aws_iid attestor doesn''t work on Fargate, how I built a custom ECS attestor plugin to replace it, and why using IAM roles as proof is more scalable than join tokens. Full architecture, integration flow, and comparison.'
  es: 'Por qué el verificador aws_iid de SPIRE no funciona en Fargate, cómo construí un plugin de verificador ECS personalizado para reemplazarlo, y por qué usar roles IAM como prueba es más escalable que tokens de unión. Arquitectura completa, flujo de integración y comparación.'
date: 2026-09-26
tags: ['spiffe', 'spire', 'ecs', 'fargate', 'aws', 'security', 'mtls', 'plugins', 'identity']
draft: false
---

<div class="lang-en">

## The Journey: Three Weeks on "The Simple Part"

When I started building Proteus (a zero-trust mesh on ECS Fargate), I thought node attestation would be straightforward. It wasn't.

I began with SPIRE's built-in `join_token` attestor — the simplest approach. Every deploy followed this fragile dance:

```
1. Generate token (one-time use, 10-min TTL)
2. Scale mesh services to 0
3. Apply Terraform with the token
4. Scale services back to 1
5. Pray the token doesn't expire mid-rollout
```

**The problems:**
- ❌ Token is one-time use — restart a task? Token burned. Start over.
- ❌ Token has TTL — if deploy is slow, it expires
- ❌ Every replica needs a unique token — doesn't scale
- ❌ Tokens live in Terraform state as plaintext
- ❌ Heavily manual, error-prone process

This is when I realized something crucial: **Fargate tasks already have proof of identity built-in** — they have an IAM role and a link-local metadata endpoint that only the task can access.

Why not use that?

---

## The Problem: Why aws_iid Doesn't Work on Fargate

SPIRE's `aws_iid` node attestor works beautifully on Kubernetes with EC2 nodes. Here's how:

### On EC2 / EKS (Works ✅)

```
EC2 Instance:
  ↓
  Pod reads: GET 169.254.169.254/latest/dynamic/instance-identity/document
  ↓
  AWS returns: Cryptographically signed Instance Identity Document
  ↓
  SPIRE Agent sends: instance-id, account-id, region + signature
  ↓
  SPIRE Server verifies: Signature matches AWS public key
  ↓
  ✅ Node SVID issued
```

The **Instance Identity Document is cryptographically signed by AWS**. The server verifies the signature using AWS's public key. A pod can't forge this — only the EC2 instance itself can read it.

### On Fargate (Fails ❌)

```
Fargate Task:
  ↓
  Agent tries: GET 169.254.169.254/latest/... 
  ↓
  ❌ NOT AVAILABLE
     (Fargate has no EC2 metadata endpoint)
  ↓
  ❌ No Instance Identity Document
  ↓
  ❌ aws_iid attestor fails completely
```

**The root cause:** Fargate abstracts away the entire EC2 layer. There is no EC2 instance, no instance metadata endpoint, and no signed document to verify.

---

## The Solution: Custom ECS Attestor Plugin

Instead of relying on Instance Identity Documents, I built `proteus_ecs` — a two-part SPIRE plugin that uses **the ECS task metadata endpoint + AWS APIs** as the trust anchor.

### How It Works

#### Part 1: Agent-Side Plugin

The agent runs inside the Fargate task and reads the ECS task metadata endpoint (link-local address 169.254.170.2 — only reachable from within the task). It extracts the task ARN, cluster, and family information, then sends this claim to the SPIRE server for verification.

**Key security property:** The metadata endpoint is **link-local** (169.254.170.2) — it can only be reached from inside the Fargate task. An attacker outside the task cannot reach it.

#### Part 2: Server-Side Plugin

The server plugin receives the claim and verifies it against AWS APIs (`DescribeTasks`, `DescribeTaskDefinition`). It checks that:
- The task exists and is in RUNNING state
- The task role ARN matches the allowed list
- Only then issues the node SVID

**Key security property:** The server calls **AWS APIs** to verify the claim. It never trusts the agent's word. The proof comes from AWS.

---

## Integration Flow: Agent Claim → Server Verification → SVID Issued

Here's the complete flow:

### Step 1: Agent Sends Claim (Unverified)

```
┌────────────────────────────────────────┐
│   Fargate Task (service-a)             │
│                                        │
│  App + Envoy + SPIRE Agent             │
│         │                              │
│         └─▶ Agent plugin sends claim   │
│            "I am TaskARN:xyz"          │
│            "Cluster: proteus"          │
│            "Family: service-a"         │
│                │                       │
└────────────────┼───────────────────────┘
                 │
                 │ CLAIM SENT (unverified, awaiting check)
                 │ TLS connection to :8081
                 │
                 ▼
        ┌────────────────────────────────────┐
        │   SPIRE Server Task (Fargate)      │
        │                                    │
        │  ⏳ VERIFYING claim received        │
        │                                    │
        └────────────────────────────────────┘
```

### Step 2: Server Verifies (Checks Happening)

```
        ┌────────────────────────────────────┐
        │   SPIRE Server Task (Fargate)      │
        │                                    │
        │  ⏳ VERIFYING — running checks:     │
        │                                    │
        │  Server plugin is calling:         │
        │         │                          │
        │         ├─▶ ECS DescribeTasks      │
        │         │   ✓ Task exists?         │
        │         │   ✓ Status RUNNING?      │
        │         │                          │
        │         ├─▶ ECS DescribeTaskDef    │
        │         │   ✓ Get role ARN         │
        │         │                          │
        │         └─▶ Check role allow-list  │
        │             ✓ Is it approved?      │
        │                                    │
        │  🚫 NOT YET: No node SVID issued   │
        │                                    │
        └────────────────────────────────────┘
```

### Step 3: Verification Passes → SVID Issued

```
        ┌────────────────────────────────────┐
        │   SPIRE Server Task (Fargate)      │
        │   ✅ VERIFICATION PASSED            │
        │                                    │
        │  All checks ✅                      │
        │  Issuing node SVID...              │
        │                                    │
        │  spiffe://proteus.local/agent/ecs/ │
        │  <task-id>                         │
        │                                    │
        └────────────────────────────────────┘
                 │
                 │ SVID sent to agent
                 │
                 ▼
┌────────────────────────────────────────┐
│   Fargate Task (service-a)             │
│   ✅ ATTESTATION COMPLETE              │
│                                        │
│  Agent now has:                        │
│  • Node SVID (proof it's trusted)      │
│  • Can request workload SVIDs          │
│  • Can serve Envoy via SDS             │
│  • Authenticated channel to server     │
│                                        │
└────────────────────────────────────────┘
```

---

## Why This Is Better Than Alternatives

### Comparison Table

| Aspect | join_token | Custom ECS Attestor |
|--------|-----------|-------------------|
| **Tokens to manage** | ❌ One per replica, per deploy | ✅ None (uses IAM role) |
| **Token TTL risk** | ❌ Expires (default 10 min) | ✅ No TTL |
| **Task restart** | ❌ Token burned, re-attest fails | ✅ Re-attests automatically |
| **Scale to N replicas** | ❌ N different tokens needed | ✅ All use same config |
| **Terraform state secrets** | ❌ Tokens visible as plaintext | ✅ No secrets |
| **Verification source** | ❌ Pre-shared secret (trust agent) | ✅ AWS APIs (trust AWS) |
| **Deploy complexity** | ❌ Manual: generate → scale → apply | ✅ Just `terraform apply` |
| **Operational burden** | ❌ High (token management) | ✅ Low (automatic) |

### Why Not Just Use EC2?

You *could* skip Fargate and run on EC2 with EKS — then `aws_iid` works natively.

But you'd lose:

- 💰 **Serverless billing** — pay only for task time, not instance uptime
- 📈 **Auto-scaling** — Fargate scales tasks independently
- 🔧 **No instance management** — no patching, no AMIs, no security groups
- 📦 **Density** — multiple tasks per instance (Fargate bin-packs)
- 🌐 **Multi-AZ resilience** — built-in

Fargate abstracts infrastructure for a reason. So adapt your attestation to Fargate's model.

---

## Implementation Details

### Plugin Architecture

```
SPIRE Agent (running inside Fargate task)
    │
    ├─▶ Loads: NodeAttestor "proteus_ecs"
    │   plugin_cmd = "/opt/spire/plugins/ecs-attestor-agent"
    │
    └─▶ gRPC over stdin/stdout (HashiCorp go-plugin)
           │
           ├─ Calls: AidAttestation()
           │  Returns: attestation payload
           │
           └─ Sends to SPIRE Server (TLS :8081)

SPIRE Server (running inside Fargate task)
    │
    ├─▶ Loads: NodeAttestor "proteus_ecs"
    │   plugin_cmd = "/opt/spire/plugins/ecs-attestor-server"
    │   plugin_data {
    │     allowed_role_arns = [
    │       "arn:aws:iam::123456:role/proteus-ecs-task"
    │     ]
    │   }
    │
    └─▶ gRPC over stdin/stdout (HashiCorp go-plugin)
           │
           ├─ Calls: Attest()
           │  Receives: attestation payload
           │
           ├─ Verifies: DescribeTasks + DescribeTaskDef
           │
           └─ Returns: NodeAttributes (SVID + selectors)
```

### Code Footprint

The entire plugin is approximately **500 lines of Go**:

- **Agent plugin** (`spire/plugins/ecs-attestor/agent/main.go`): ~190 lines
  - Reads ECS metadata endpoint
  - Marshals payload
  - Sends to server

- **Server plugin** (`spire/plugins/ecs-attestor/server/main.go`): ~300 lines
  - Receives payload
  - Calls AWS APIs
  - Verifies role ARN
  - Issues SVID

Both use **HashiCorp's `go-plugin` framework** (gRPC over stdin/stdout). This means:
- ✅ Crash isolation — if plugin crashes, it doesn't crash SPIRE
- ✅ No version coupling — agent and server versions can differ
- ✅ Simple deployment — just binary in Docker, no dynamic libs

---

## Limitations and Trade-offs

### Server Needs ECS API Permissions

The server-side plugin calls ECS APIs, so the SPIRE Server task requires IAM permissions:

```json
{
  "Action": [
    "ecs:DescribeTasks",
    "ecs:DescribeTaskDefinition"
  ],
  "Resource": "*"
}
```

This is acceptable — SPIRE Server is already a trusted control-plane component.

### Explicit Role Allow-list Required

You maintain an allow-list of approved task roles:

```hcl
NodeAttestor "proteus_ecs" {
  plugin_cmd = "/opt/spire/plugins/ecs-attestor-server"
  plugin_data {
    allowed_role_arns = [
      "arn:aws:iam::123456:role/proteus-ecs-task"
    ]
  }
}
```

**Why this is actually a feature:** It prevents any random task from joining SPIRE. Only tasks with approved roles can attest.

### Admission Controller Is Still Manual

Node attestation is automatic. Workload admission still requires explicit action (e.g., `POST /admit` to the admission controller).

This separation is intentional — it enforces the two-layer identity model:
1. **Node attestation** (automatic) — which *task* do we trust?
2. **Workload admission** (manual) — which *service identity* does it get?

---

## Deploy Before vs After

### BEFORE (join_token)

```bash
# 1. Scale SPIRE server up
aws ecs update-service --cluster proteus --service proteus-spire \
  --desired-count 1

# 2. Wait for it to be healthy
sleep 60

# 3. ECS exec into server and generate token
SPIRE_TASK=$(aws ecs list-tasks --cluster proteus --service-name proteus-spire \
  --query 'taskArns[0]' --output text)
TOKEN=$(timeout 12 aws ecs execute-command --cluster proteus --task $SPIRE_TASK \
  --container spire-server --interactive \
  --command '/opt/spire/bin/spire-server token generate -spiffeID spiffe://proteus.local/agent/service-a' \
  --region us-east-1 2>&1 | tr -d '\r' | grep "Token:" | awk '{print $2}')

# 4. Scale services to 0 (kill old tasks)
aws ecs update-service --cluster proteus --service proteus-service-a --desired-count 0

# 5. Wait for drain
sleep 30

# 6. Apply Terraform with token
cd terraform
terraform apply -var="service_a_join_token=$TOKEN"

# 7. Scale services back up
aws ecs update-service --cluster proteus --service proteus-service-a --desired-count 1

# 8. Wait and verify
sleep 60
aws ecs execute-command --cluster proteus --task $SPIRE_TASK \
  --container spire-server --interactive \
  --command '/opt/spire/bin/spire-server agent list' | tr -d '\r'
```

**Problems:**
- ❌ 8 manual steps
- ❌ Fragile (token TTL, parsing issues)
- ❌ Doesn't scale (need N tokens for N replicas)

### AFTER (ECS task role attestor)

```bash
# Step 1: Build and push images (one-time after code change)
docker build -t proteus/spire-agent -f mesh-fargate/spire-agent/Dockerfile .
docker tag proteus/spire-agent:latest 123456.dkr.ecr.us-east-1.amazonaws.com/proteus/spire-agent:latest
docker push 123456.dkr.ecr.us-east-1.amazonaws.com/proteus/spire-agent:latest

# Step 2: Apply Terraform
cd terraform
terraform apply

# Step 3: Scale up and verify
aws ecs update-service --cluster proteus --service proteus-spire --desired-count 1
sleep 60

aws ecs update-service --cluster proteus --service proteus-service-a --desired-count 1
sleep 60

# Verify
SPIRE_TASK=$(aws ecs list-tasks --cluster proteus --service-name proteus-spire \
  --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster proteus --task $SPIRE_TASK \
  --container spire-server --interactive \
  --command '/opt/spire/bin/spire-server agent list' | tr -d '\r'
```

**Advantages:**
- ✅ 3 logical steps (build, apply, scale)
- ✅ Robust (no tokens, no TTL)
- ✅ Scales automatically (N replicas, same config)
- ✅ Task restarts? Re-attests automatically

---

## Key Insights

1. **You don't need a pre-shared secret** — the task already has proof of identity (its IAM role)

2. **The server is the trust anchor** — it verifies via AWS APIs, not the agent's word

3. **Link-local metadata is your boundary** — the ECS endpoint (169.254.170.2) is only reachable from the task

4. **Separate attestation from admission** — node attestation proves which *task*; admission controller decides which *service identity* it gets

5. **Use the infrastructure you already have** — IAM roles exist, metadata endpoints exist; no extra infrastructure needed

---

## Resources

- **Full Proteus project:** https://github.com/kiquetal/proteus-oss
- **Original SPIFFE on ECS blog post:** https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
- **SPIRE documentation:** https://spiffe.io/docs/latest/spire-about/
- **SPIRE plugin SDK:** https://github.com/spiffe/spire-plugin-sdk
- **AWS ECS Task Metadata v4:** https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4-fargate.html
- **HashiCorp go-plugin:** https://github.com/hashicorp/go-plugin

</div>

<div class="lang-es hidden">

## El Viaje: Tres Semanas en "La Parte Simple"

Cuando comencé a construir Proteus (una malla zero-trust en ECS Fargate), pensé que la atestación de nodo sería sencilla. No lo fue.

Comencé con el verificador `join_token` incorporado de SPIRE — el enfoque más simple. Cada despliegue seguía este baile frágil:

```
1. Generar token (de un solo uso, TTL de 10 min)
2. Reducir servicios mesh a 0
3. Aplicar Terraform con el token
4. Volver a escalar servicios a 1
5. Rezar para que el token no expire
```

**Los problemas:**
- ❌ El token es de un solo uso — ¿reiniciar una tarea? Token quemado. Empezar de nuevo.
- ❌ El token tiene TTL — si el despliegue es lento, expira
- ❌ Cada réplica necesita un token único — no escala
- ❌ Los tokens viven en el estado de Terraform en texto plano
- ❌ Proceso altamente manual y propenso a errores

Fue entonces cuando me di cuenta de algo crucial: **Las tareas de Fargate ya tienen prueba de identidad incorporada** — tienen un rol IAM y un endpoint de metadatos link-local que solo la tarea puede acceder.

¿Por qué no usar eso?

---

## El Problema: Por Qué aws_iid No Funciona en Fargate

El verificador `aws_iid` de SPIRE funciona hermosamente en Kubernetes con nodos EC2. Así funciona:

### En EC2 / EKS (Funciona ✅)

```
Instancia EC2:
  ↓
  Pod lee: GET 169.254.169.254/latest/dynamic/instance-identity/document
  ↓
  AWS devuelve: Documento de Identidad de Instancia firmado criptográficamente
  ↓
  Agente SPIRE envía: instance-id, account-id, region + firma
  ↓
  Servidor SPIRE verifica: La firma coincide con la clave pública de AWS
  ↓
  ✅ Se emite SVID de nodo
```

El **Documento de Identidad de Instancia está firmado criptográficamente por AWS**. El servidor verifica la firma usando la clave pública de AWS. Un pod no puede falsificarlo — solo la instancia EC2 puede leerlo.

### En Fargate (Falla ❌)

```
Tarea Fargate:
  ↓
  Agente intenta: GET 169.254.169.254/latest/... 
  ↓
  ❌ NO DISPONIBLE
     (Fargate no tiene endpoint de metadatos EC2)
  ↓
  ❌ Sin Documento de Identidad de Instancia
  ↓
  ❌ El verificador aws_iid falla completamente
```

**La causa raíz:** Fargate abstrae completamente la capa EC2. No hay instancia EC2, no hay endpoint de metadatos de instancia, y no hay documento firmado para verificar.

---

## La Solución: Plugin de Verificador ECS Personalizado

En lugar de confiar en Documentos de Identidad de Instancia, construí `proteus_ecs` — un plugin SPIRE de dos partes que usa **el endpoint de metadatos de tarea ECS + APIs de AWS** como ancla de confianza.

### Cómo Funciona

#### Parte 1: Plugin del Lado del Agente

El agente se ejecuta dentro de la tarea Fargate y lee el endpoint de metadatos ECS (dirección link-local 169.254.170.2 — solo accesible desde dentro de la tarea). Extrae la información del ARN de la tarea, cluster y familia, y luego envía esta reclamación al servidor SPIRE para verificación.

**Propiedad de seguridad clave:** El endpoint de metadatos es **link-local** (169.254.170.2) — solo se puede acceder desde dentro de la tarea Fargate. Un atacante fuera de la tarea no puede alcanzarlo.

#### Parte 2: Plugin del Lado del Servidor

El plugin del servidor recibe la reclamación y la verifica contra las APIs de AWS (`DescribeTasks`, `DescribeTaskDefinition`). Verifica que:
- La tarea existe y está en estado RUNNING
- El ARN del rol de la tarea coincide con la lista permitida
- Solo entonces emite el SVID de nodo

**Propiedad de seguridad clave:** El servidor llama a **APIs de AWS** para verificar la reclamación. Nunca confía en la palabra del agente. La prueba proviene de AWS.

---

## Flujo de Integración: Reclamación del Agente → Verificación del Servidor → SVID Emitido

Aquí está el flujo completo:

### Paso 1: Agente Envía Reclamación (No Verificada)

```
┌────────────────────────────────────────┐
│   Tarea Fargate (service-a)            │
│                                        │
│  App + Envoy + Agente SPIRE            │
│         │                              │
│         └─��� Plugin de agente envía     │
│            "Soy TaskARN:xyz"           │
│            "Cluster: proteus"          │
│            "Family: service-a"         │
│                │                       │
└────────────────┼───────────────────────┘
                 │
                 │ RECLAMACIÓN ENVIADA (sin verificar, esperando verificación)
                 │ Conexión TLS a :8081
                 │
                 ▼
        ┌────────────────────────────────────┐
        │   Servidor SPIRE (Tarea Fargate)   │
        │                                    │
        │  ⏳ VERIFICANDO reclamación recibida│
        │                                    │
        └────────────────────────────────────┘
```

### Paso 2: Servidor Verifica (Verificaciones en Curso)

```
        ┌────────────────────────────────────┐
        │   Servidor SPIRE (Tarea Fargate)   │
        │                                    │
        │  ⏳ VERIFICANDO — ejecutando checks:│
        │                                    │
        │  Plugin de servidor está llamando: │
        │         │                          │
        │         ├─▶ ECS DescribeTasks      │
        │         │   ✓ ¿Existe la tarea?    │
        │         │   ✓ ¿Estado RUNNING?     │
        │         │                          │
        │         ├─▶ ECS DescribeTaskDef    │
        │         │   ✓ Obtener ARN del rol  │
        │         │                          │
        │         └─▶ Verificar allow-list   │
        │             ✓ ¿Está aprobado?      │
        │                                    │
        │  🚫 AÚN NO: Sin SVID de nodo       │
        │                                    │
        └────────────────────────────────────┘
```

### Paso 3: Verificación Aprobada → SVID Emitido

```
        ┌────────────────────────────────────┐
        │   Servidor SPIRE (Tarea Fargate)   │
        │   ✅ VERIFICACIÓN APROBADA          │
        │                                    │
        │  Todas las verificaciones ✅        │
        │  Emitiendo SVID de nodo...         │
        │                                    │
        │  spiffe://proteus.local/agent/ecs/ │
        │  <task-id>                         │
        │                                    │
        └────────────────────────────────────┘
                 │
                 │ SVID enviado al agente
                 │
                 ▼
┌────────────────────────────────────────┐
│   Tarea Fargate (service-a)            │
│   ✅ ATESTACIÓN COMPLETA               │
│                                        │
│  Agente ahora tiene:                   │
│  • SVID de nodo (prueba de confianza)  │
│  • Puede solicitar SVIDs de workload   │
│  • Puede servir Envoy vía SDS          │
│  • Canal autenticado al servidor       │
│                                        │
└────────────────────────────────────────┘
```

---

## Tabla de Comparación

| Aspecto | join_token | Verificador ECS Personalizado |
|---------|-----------|------------------------------|
| **Tokens a administrar** | ❌ Uno por réplica, por despliegue | ✅ Ninguno (usa rol IAM) |
| **Riesgo de expiración** | ❌ Expira (TTL por defecto 10 min) | ✅ Sin TTL |
| **Reinicio de tarea** | ❌ Token quemado, re-atestación falla | ✅ Se re-atestigua automáticamente |
| **Escalar a N réplicas** | ❌ Se necesitan N tokens diferentes | ✅ Todas usan la misma configuración |
| **Secretos en estado de Terraform** | ❌ Tokens visibles en texto plano | ✅ Sin secretos |
| **Fuente de verificación** | ❌ Secreto pre-compartido (confiar en agente) | ✅ APIs de AWS (confiar en AWS) |
| **Complejidad de despliegue** | ❌ Manual: generar → escalar → aplicar | ✅ Solo `terraform apply` |
| **Carga operacional** | ❌ Alta (administración de tokens) | ✅ Baja (automática) |

---

## Recursos

- **Proyecto completo Proteus:** https://github.com/kiquetal/proteus-oss
- **Blog original SPIFFE en ECS:** https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
- **Documentación SPIRE:** https://spiffe.io/docs/latest/spire-about/
- **SDK de plugin SPIRE:** https://github.com/spiffe/spire-plugin-sdk
- **Metadatos de tarea ECS v4 de AWS:** https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4-fargate.html
- **HashiCorp go-plugin:** https://github.com/hashicorp/go-plugin

</div>

