# Why SPIRE's aws_iid Attestor Doesn't Work on Fargate — And What I Built Instead

> **AWS Builder Center draft.** Paste this into the community.aws editor.
> Wherever you see `[📷 UPLOAD IMAGE HERE: ...]`, delete that line and upload
> the named image manually at that position in the editor.
>
> **Title (paste into the editor's Title field):**
> Why SPIRE's aws_iid Node Attestor Doesn't Work on Fargate — And How to Fix It
>
> **Brief description / summary (paste into the editor's Description field):**
> SPIRE's built-in aws_iid attestor works great on Kubernetes/EC2, but Fargate has
> no EC2 instance to anchor trust to. This post explains why — and shows the custom
> ECS attestor plugin I built to replace it, how it integrates client and server
> plugins, and why it's more scalable than pre-shared tokens.
>
> **Canonical URL (set this in the editor):**
> https://github.com/kiquetal/proteus-oss
>
> **Suggested tags/topics (add in the editor):**
> `Amazon ECS`, `AWS Fargate`, `Security`, `SPIFFE`, `SPIRE`, `Zero Trust`, `Attestation`,
> `mTLS`, `Identity`, `Containers`, `Kubernetes`

---

## The Problem: Why aws_iid Doesn't Work on Fargate

When you run SPIRE on Kubernetes with EC2 nodes, proving a workload's identity is straightforward: **SPIRE trusts the EC2 Instance Identity Document (IID).**

Here's how it works on EKS:

```
┌────────────────┐
│   EC2 Instance │
│                │
│  Pod running   │
│  SPIRE Agent   │
│        │       │
│        └──────▶ GET 169.254.169.254/latest/dynamic/instance-identity/document
│                (AWS returns signed IID with account ID, instance ID, region)
│                │
│        SPIRE Agent reads IID
│        Sends: instance-id, account-id, region
│                │
└────────────────┘
         │
         │ SPIRE Server validates
         │ (signature matches AWS public key)
         │
         ▼
    ✅ Node SVID issued
```

The **Instance Identity Document is cryptographically signed by AWS** — the SPIRE Server verifies the signature using AWS's public key, and trusts the result. A pod can't forge this document; only the EC2 instance itself can read it.

**But on Fargate, there is no EC2 instance.**

Fargate tasks don't have access to the EC2 metadata service (`169.254.169.254`). They can't read an Instance Identity Document. So the entire aws_iid attestor chain breaks:

```
┌────────────────┐
│  Fargate Task  │
│                │
│  App + SPIRE   │
│    Agent       │
│        │       │
│        └──────▶ GET 169.254.169.254/latest/... ❌ NOT AVAILABLE
│                (Fargate has no EC2 metadata endpoint)
│
└────────────────┘
         │
         │ ❌ aws_iid attestor fails
         │    No Instance Identity Document to verify
         │
         ▼
    ❌ Node SVID NOT issued
    Agent cannot attest
```

**The root cause:** Fargate abstracts away the EC2 layer entirely. From the task's perspective, there is no instance, no instance metadata endpoint, and no signed document to prove identity with.

---

## What You Could Try (and Why Each Falls Short)

### Option 1: Pre-shared Tokens (join_token)

The simplest SPIRE attestor — generate a one-time token, pass it to the task, the task uses it to prove it's authorized.

**Why it fails on Fargate:**

```
DEPLOY FLOW (fragile):
t=0   Generate token (TTL: 10 minutes)
t=1   Scale services to 0 (old tasks die, old tokens burn)
t=2   Apply Terraform with new token
t=3   Scale services to 1 (tasks boot)
t=4   If any task takes > 10 min to start, token expires ❌
t=5   If any task restarts, token is one-time-use (❌ burned)
t=6   If you want to scale to 10 replicas, you need 10 different tokens ❌
```

**The problem:** Tokens are one-time-use, have TTL, and don't scale. Every new replica needs its own token. Every restart burns the token. Every deploy is fragile.

[📷 UPLOAD IMAGE HERE: Timeline showing join_token pain points — token expiration, one-time use, scaling friction]

### Option 2: AWS Lambda Authorizer / Custom Signer

Imagine you have a Lambda that signs attestations for Fargate tasks. You call it from your task, it verifies you're running on Fargate, signs a document, you send it to SPIRE.

**Why it still fails:**

- **Coupling:** Now SPIRE depends on a Lambda being up and reachable
- **Latency:** Every attestation is an extra Lambda call
- **Cost:** Extra API calls, Lambda invocations
- **Complexity:** You're building an extra service just to sign claims
- **Circular trust:** How does Lambda know the task is real? It still needs to verify *something* — and that brings you back to the problem of how to prove identity without an EC2 instance

### Option 3: IAM Role as Proof (The Right Answer)

**Core insight:** Fargate tasks *do* have proof of identity — they have an **IAM role** and can prove they're using it via AWS APIs.

Every Fargate task:
- ✅ Has a task role (an IAM role)
- ✅ Has temporary credentials from that role (in environment vars)
- ✅ Can call AWS APIs with those credentials
- ✅ AWS will verify those credentials are real

So the question becomes: **Can we use AWS APIs to verify the task is real, and that its IAM role is approved?**

Answer: **Yes — with a custom SPIRE attestor plugin.**

---

## The Solution: Custom ECS Attestor Plugin

I built `proteus_ecs` — a two-part SPIRE plugin (agent-side + server-side) that uses **the ECS task metadata endpoint + the ECS API** as the trust anchor instead of Instance Identity Documents.

### How It Works

**1. Agent-side plugin (runs inside the Fargate task):**

The agent plugin reads the ECS task metadata endpoint (link-local address 169.254.170.2 — only reachable from within the task). It extracts the task ARN, cluster, and family information, then sends this claim to the SPIRE server for verification.

**Key security property:** The metadata endpoint is **link-local** (169.254.170.2) — it's only reachable from within the Fargate task. An attacker outside the task can't reach it.

**2. Server-side plugin (runs in the SPIRE Server task):**

The server plugin receives the claim and verifies it against AWS APIs (`DescribeTasks`, `DescribeTaskDefinition`). It checks that:
- The task exists and is in RUNNING state
- The task role ARN matches the allowed list
- Only then issues the node SVID

**Key security property:** The server calls **AWS APIs** to verify the claim — it never trusts the agent's word alone.

### The Integration Flow

Here's how agent and server communicate:

```
┌────────────────────────────────────────┐
│   Fargate Task (service-a)             │
│                                        │
│  Agent plugin sends claim:             │
│  "I am arn:aws:ecs:.../task/xyz"       │
│  "Cluster: proteus"                    │
│                │                       │
└────────────────┼───────────────────────┘
                 │
                 │ CLAIM SENT
                 │ (unverified)
                 │
                 ▼
        ┌────────────────────────────────┐
        │   SPIRE Server Task            │
        │                                │
        │  ⏳ VERIFYING...                 │
        │                                │
        │  Server plugin calls:          │
        │  1. ECS DescribeTasks          │
        │     → task exists? RUNNING?    │
        │  2. ECS DescribeTaskDef        │
        │     → get role ARN             │
        │  3. Check role in allow-list   │
        │                                │
        │  🚫 NOT YET: No cert issued    │
        │                                │
        └────────────────────────────────┘
                 │
                 │ (if all checks pass ✅)
                 │
                 ▼
        ┌────────────────────────────────┐
        │   SPIRE Server                 │
        │                                │
        │  ✅ VERIFIED                    │
        │  Issue node SVID               │
        │  agent/ecs/<task-id>           │
        │                                │
        └────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │   Agent has cert               │
        │                                │
        │  Can request workload SVIDs    │
        │  Can serve Envoy over SDS      │
        │                                │
        └────────────────────────────────┘
```

---

## Why This Is Better Than Alternatives

| Aspect | join_token | Custom ECS Attestor |
|--------|-----------|-------------------|
| **Tokens to manage** | ❌ One per replica, one per deploy | ✅ None (uses IAM role) |
| **Token TTL risk** | ❌ Yes (default 10 min) | ✅ No TTL |
| **Handles task restart** | ❌ Token burned | ✅ Re-attests automatically |
| **Scales to N replicas** | ❌ N different tokens | ✅ All auto-attest with same config |
| **Terraform state secrets** | ❌ Tokens visible as plaintext | ✅ No secrets in state |
| **Verification source** | ❌ Pre-shared secret (trust agent's word) | ✅ AWS APIs (trust AWS's verification) |
| **Manual deploy steps** | ❌ Yes (generate, scale to 0, apply, scale to 1) | ✅ Just `terraform apply` |

---

## Why Not Just Use EC2 Instances?

You *could* skip Fargate and run on EC2 with EKS — then you could use aws_iid directly.

But you'd lose:

- **Serverless billing:** Pay only for task time, not instance uptime
- **Automatic scaling:** Fargate scales tasks independently of instance capacity
- **No instance management:** No patching, no security groups, no AMIs to maintain
- **Density:** Multiple tasks per instance (Fargate handles bin-packing)
- **Multi-AZ resilience:** Built-in

The whole point of Fargate is to abstract away infrastructure. Using aws_iid on EC2/EKS works — but if you're on Fargate, you need to adapt your attestation to Fargate's model.

---

## Limitations and Trade-offs

### The plugin must run in a task with ECS DescribeTasks permission

The server-side plugin calls ECS APIs, so the SPIRE Server task needs IAM permission:

```json
{
  "Action": [
    "ecs:DescribeTasks",
    "ecs:DescribeTaskDefinition"
  ],
  "Resource": "*"
}
```

This is fine — SPIRE Server is already a trusted control-plane component.

### Role ARN checking relies on IAM role allow-list

You have to maintain an explicit allow-list of task roles:

```hcl
NodeAttestor "proteus_ecs" {
  plugin_data {
    allowed_role_arns = ["arn:aws:iam::123456:role/proteus-ecs-task"]
  }
}
```

Only tasks with an allowed role can attest. This is actually a *feature* — it prevents any random task from joining SPIRE.

### Admission controller is still manual (for now)

Node attestation is automatic, but workload admission still requires an explicit `POST /admit` to the admission controller. (Could be automated with service discovery later.)

---

## Code Footprint

The entire plugin is **~500 lines of Go** across two files:

- `spire/plugins/ecs-attestor/agent/main.go` — ~190 lines
- `spire/plugins/ecs-attestor/server/main.go` — ~300 lines

Uses HashiCorp's `go-plugin` framework (gRPC over stdin/stdout). Both agent and server are completely decoupled — if the agent crashes, it doesn't crash SPIRE. If the server plugin fails, it returns a gRPC error and attestation fails gracefully.

---

## Next Steps

If you're running SPIRE on Fargate and hit the "no aws_iid" wall:

1. **Don't use join_token** — it doesn't scale and is fragile
2. **Build a custom attestor** — or use `proteus_ecs` as a reference
3. **Use IAM role as proof** — it's already there, no extra infrastructure needed
4. **Layer admission on top** — separate which *task* you trust from which *service identity* it may hold

The full implementation (with tests, Dockerfiles, and Terraform) is in the [Proteus GitHub repo](https://github.com/kiquetal/proteus).

---

### Resources

- **Full Proteus OSS project:** https://github.com/kiquetal/proteus-oss
- **Blog post (SPIFFE on ECS overview):** https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
- SPIRE documentation: https://spiffe.io/docs/latest/spire-about/
- SPIRE node attestor plugin SDK: https://github.com/spiffe/spire-plugin-sdk
- AWS ECS Metadata Endpoint v4: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4-fargate.html

---

### Image upload checklist (for the editor)

1. `ec2-vs-fargate-attestation.png` — after "The Problem" section (showing aws_iid working on EC2, failing on Fargate)
2. `proteus-ecs-integration-flow.png` — after "The Integration Flow" section
3. `join-token-vs-ecs-attestor-timeline.png` — after the comparison table
4. `proteus-ecs-plugin-stack.png` — after "Code Footprint" section (showing agent plugin + server plugin architecture)

