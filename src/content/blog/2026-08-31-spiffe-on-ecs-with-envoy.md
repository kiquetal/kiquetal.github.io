---
title:
  en: 'SPIFFE on ECS with Envoy'
  es: 'SPIFFE en ECS con Envoy'
excerpt:
  en: 'TODO'
  es: 'TODO'
date: 2026-08-31
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

A very simple architecture which works in the following way:

- A ecs task is started, the envoy sidecar is started and it connects to the SPIRE-Agent to get the SVIDs.
- The SPIRE-Agent connects to the SPIRE-Server to get the SVIDs.
- At first not service were admitted, so the service discovery fails when try to obtain the CERTS, 
showing operation not authozized.
- Once the service is admitted, the service discovery the envoy recevies the SVIDS.






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
