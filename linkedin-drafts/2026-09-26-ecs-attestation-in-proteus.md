# LinkedIn Draft: Why I Built a Custom ECS Attestor (And How It Changed Everything)

> 📷 **Image Recommendation**: Attach the "BEFORE vs AFTER" deploy dance comparison (join_token manual steps vs. ECS task role automatic) or the plugin architecture diagram (agent → metadata endpoint → server → DescribeTasks).

> ⚠️ **Note**: Before publishing, link to the blog post `/blog/2026-09-26-ecs-attestation-in-proteus.md` (tbd) or to the Proteus GitHub repo.

---
## ✅ READY TO POST — Bilingual (~2,800 chars)

---

## English Version — LINKEDIN (Optimized for 3,000 char limit)

Three weeks on "the simple part" of Proteus — SPIRE agents on ECS Fargate. Turns out, it wasn't simple. 🧵

Started with `join_token` attestor:
1. Generate token (one-time use, 10-min TTL)
2. Scale to 0 → update config → scale to 1
3. Pray token doesn't expire
4. If task restarts? Token burned. Start over.

**The problem:** Fargate has no EC2 host. No instance metadata. No way to prove identity the traditional way.

But Fargate tasks have something better — **an IAM role and a link-local metadata endpoint** (169.254.170.2, only reachable from inside the task).

So I built a custom SPIRE plugin (agent + server):

**Agent plugin:** Reads ECS task metadata → sends {TaskARN, Cluster, Family} to server
**Server plugin:** Calls ECS API (DescribeTasks + DescribeTaskDefinition) → verifies task is RUNNING → checks role is allowed → issues node SVID

That's it. No token generation. No TTL. No one-time use.

```
BEFORE: Manual token → scale to 0 → reconfigure → scale to 1 → risk

AFTER: deploy with same setup → done. Task restarts? Re-attests automatically. Scale to 100? All auto-attest.
```

**Why it works:** You don't need a pre-shared secret. The task already has proof of identity: its IAM role. The server verifies it via AWS APIs. The agent proves it using a link-local endpoint only it can access.

The architecture is simple: agent claim + server verification + node SVID.

Flow diagram and context: https://kiquetal.dev/blog/2026-09-26-ecs-attestation-in-proteus

#SPIRE #SPIFFE #AWS #ECS #Fargate #ZeroTrust #DevSecOps

---

## Versión en Español

Pasé tres semanas en "la parte simple" de Proteus — lograr que los agentes SPIRE se atestigüen en ECS Fargate. Resulta que, no era simple en absoluto. 🧵

Al principio, usé el verificador de token incorporado `join_token` de SPIRE. Cada deploy se veía así:
1. Generar token (de un solo uso, TTL de 10 min)
2. Reducir los servicios mesh a 0
3. Aplicar configuración con el token
4. Volver a escalar los servicios a 1
5. Rezar para que el token no expire durante el despliegue

**¿Lo mejor?** Si una tarea se reiniciaba, el token se quemaba. Sin recuperación. Empezar de nuevo.

Entonces me di cuenta: **Las tareas de Fargate tienen algo mejor que los tokens pre-compartidos — tienen un rol IAM y un endpoint de metadata.**

Así que construí un sistema de plugin SPIRE donde **agente y servidor están estrechamente integrados**:

1️⃣ **Plugin de agente** lee el endpoint de metadata de la tarea ECS (`http://169.254.170.2/v4/task` — link-local, solo accesible desde *dentro* de la tarea)

2️⃣ Envía `{TaskARN, Cluster, Family}` al servidor SPIRE para verificación

3️⃣ **Plugin de servidor** recibe la afirmación y llama a `ECS DescribeTasks` + `DescribeTaskDefinition` para verificar:
   - ✅ La tarea existe y está en RUNNING
   - ✅ El ARN del rol de tarea coincide con la lista permitida

4️⃣ **Solo entonces** emite un SVID de nodo: `spiffe://proteus.local/agent/ecs/<task-id>`

**El momento "en espera"** — entre afirmación y aprobación:

```
┌────────────────────────────────────────┐
│   Tarea de Servicio (Fargate)          │
│                                        │
│  App + Envoy + Agente SPIRE            │
│         │                              │
│         └─▶ Plugin de agente envía     │
│            "Soy TaskARN:xyz"           │
│            "Cluster: proteus"          │
│                │                       │
└────────────────┼───────────────────────┘
                 │
                 │ AFIRMACIÓN ENVIADA (esperando verificación)
                 │
                 ▼
        ┌────────────────────────────────────┐
        │  Tarea Servidor SPIRE (Fargate)    │
        │                                    │
        │  ⏳ VERIFICANDO — afirmación recibida│
        │                                    │
        │  Plugin del servidor está         │
        │  comprobando:                      │
        │         │                          │
        │         ├─▶ ¿DescribeTasks?      │
        │         │   ¿Existe la tarea?    │
        │         │   ¿Está en RUNNING?    │
        │         │                          │
        │         ├─▶ ¿DescribeTaskDef?    │
        │         │   Obtener ARN del rol  │
        │         │                          │
        │         └─▶ ¿Rol permitido?       │
        │             Verificar lista       │
        │                                    │
        │  🚫 AÚN NO: Sin SVID de nodo      │
        │                                    │
        └────────────────────────────────────┘
```

**Solo después de que pasa la verificación** → servidor emite SVID de nodo:

```
┌────────────────────────────────────────┐
│   Tarea de Servicio (Fargate)          │
│   ✅ ATESTACIÓN APROBADA                │
│                                        │
│  App + Envoy + Agente SPIRE            │
│         │                              │
│         └─▶ Plugin de agente verificado│
│            Enviado: TaskARN → Servidor │
│                                        │
│            Ahora tiene SVID de nodo    │
│            Puede solicitar certs       │
│                │                       │
└────────────────┼───────────────────────┘
                 │
                 │ TLS autenticado
                 │ (con SVID de nodo)
                 │
                 ▼
        ┌────────────────────────────────────┐
        │  Tarea Servidor SPIRE (Fargate)    │
        │  ✅ VERIFICADO: Rol aprobado       │
        │                                    │
        │  Servidor SPIRE + ctrl admisión    │
        │         │                          │
        │         └─▶ Ejecutó plugin srv     │
        │            │                       │
        │            ├─▶ DescribeTasks ✅   │
        │            ├─▶ DescribeTaskDef ✅ │
        │            └─▶ Rol permitido ✅    │
        │                                    │
        │    Emitió SVID de nodo al agente  │
        │    Agente ahora atestiguado       │
        │                                    │
        └────────────────────────────────────┘
```

¿Resultado?

```
ANTES (join_token):
  Generación manual de token → reducir a 0 → reconfigurar → escalar a 1 → riesgo

DESPUÉS (rol de tarea ECS):
  desplegar con la misma configuración → listo. Cualquier réplica se atestigua automáticamente.
  ¿Se reinicia una tarea? Se atestigua automáticamente. ¿Escalar a 100? Todas se atestiguan automáticamente.
```

**La clave:** No necesitas un secreto pre-compartido. La tarea ya tiene prueba de identidad: su rol IAM. El servidor puede verificarlo llamando a las APIs de AWS. El agente lo prueba leyendo un endpoint link-local solo al que puede acceder.

Sin tokens. Sin TTL. Sin uso de un solo uso. Solo criptografía y APIs de la nube.

**Nota:** Esto es solo atestación de nodo — probar la *tarea*. El admission controller es una puerta separada que decide qué *identidad de servicio* puede tener esa tarea. Ambas deben pasar para que una aplicación funcione con mTLS (el post de blog cubre ambas capas en detalle).

La arquitectura es simple: reclamación del agente + verificación del servidor + SVID de nodo.

Comparto el flujo con diagramas de arquitectura en el proyecto Proteus. Link en bio.

#SPIRE #SPIFFE #AWS #ECS #Fargate #ZeroTrust #DevSecOps #Kubernetes #GestiónddeIdentidad
