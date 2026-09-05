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


We have configured the envoy to go from service-a to service-b using mtls, for this goal we configured the envoy to use SDS (Secret Discovery Service) to get the SVIDs from SPIRE-Agent, and we configured the SPIRE-Agent to get the SVIDs from SPIRE-Server.

The admission controller is used to allow/deny the registration of the service in the service discovery, this is a very important step to avoid that a malicious service can register in the service discovery and get access to the other services.

## Testing the architecture

The setup is intentionally minimal: two ECS services, `service-a` (the caller) and `service-b` (the callee), each with an Envoy sidecar and a co-located SPIRE Agent. `service-a` calls `service-b` over mTLS on `/api/data`. Both proxies fetch their identities from SPIRE via SDS.

The test walks through a **dark → admit → live** progression, proving that no workload receives an identity until it has been explicitly admitted.

### Step 1 — Dark state: no workload is admitted yet

Before any admission, Envoy asks SPIRE for an SVID and is rejected. The Envoy log on `service-a` shows the request failing with `503 flags=UF` and, underneath, the SDS stream being closed:

`workload is not authorized for the requested identities ["spiffe://proteus.local/service-a"]`

![Envoy on service-a denied — workload not authorized, 503 UF](/blog/2026-08-31-spiffe-on-ecs-with-envoy/svc-a-dark.png)

On the `service-b` side, the SPIRE Agent reports the same thing from its own perspective — an SDS `StreamSecrets` request for `spiffe://proteus.local/service-b` fails with `InvalidArgument: workload is not authorized`:

![SPIRE Agent on service-b denied — error building stream secrets](/blog/2026-08-31-spiffe-on-ecs-with-envoy/spire-agent-svc-b-dark.png)

This is the whole point of the design: identity is deny-by-default.

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

![Proteus C4 Container — SPIRE Server, Admission Controller, Envoy sidecars](/blog/2026-08-31-spiffe-on-ecs-with-envoy/c4-container-en.png)

</div>

<div class="lang-es hidden">

TODO — introducción

![SPIFFE en ECS con Envoy](/blog/2026-08-31-spiffe-on-ecs-with-envoy/hero-es.png)

</div>
