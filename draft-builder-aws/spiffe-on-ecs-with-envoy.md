# SPIFFE on ECS with Envoy — A Poor Man's Zero Trust on Fargate

> **AWS Builder Center draft.** Paste this into the community.aws editor.
> Wherever you see `[📷 UPLOAD IMAGE HERE: ...]`, delete that line and upload
> the named image manually at that position in the editor.
>
> **Canonical URL (set this in the editor):**
> https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
>
> **Suggested tags/topics (add in the editor):**
> `Amazon ECS`, `AWS Fargate`, `Security`, `Containers`, `Zero Trust`, `mTLS`,
> `SPIFFE`, `SPIRE`, `Envoy`, `Identity`
> (Builder Center usually expects a mix of AWS service tags + topic tags —
> lead with `Amazon ECS` / `AWS Fargate` / `Security` for discoverability.)

---

## Vision

I love Istio, but I wanted to understand what actually happens under the hood. So I set out to build a "poor man's" zero-trust mesh on Amazon ECS: mutual TLS between services, no long-lived secrets, and workload identity that rotates automatically — all without a managed service mesh doing the magic for me.

The hard question that shaped everything: **how do you attest a workload's identity on Fargate, where there's no EC2 host to anchor trust to?**

The answer is two layers of identity, each answering a different question:

- **Node attestation** — *is this really the ECS task it claims to be?*
- **Workload attestation + admission** — *is this task allowed to hold this service identity?*

A workload only gets a usable identity when both pass. Identity is deny-by-default.

[📷 UPLOAD IMAGE HERE: Proteus container diagram — proteus-container.png (SPIRE Server + Admission Controller task, and two service tasks each with app, Envoy sidecar egress :9903 / ingress :9902, and SPIRE Agent)]

## How we built it (process, key decisions, challenges)

### Node attestation — proving the ECS task

On Fargate there is no EC2 instance, so the usual `aws_iid` node attestor doesn't apply. I wrote a custom node attestor, `proteus_ecs`, and like every SPIRE node attestor it comes in **two halves**: an agent-side plugin that gathers and sends the claim, and a server-side plugin that verifies it.

The agent side reads the ECS task metadata endpoint and forwards the task ARN, cluster and family. The important part is on the **server side**: it never trusts that payload blindly — it calls the ECS API (`DescribeTasks`) to confirm the task really exists and to fetch its real IAM role, then checks that role against an allow-list. A task can *claim* an ARN, but it can't forge one, because the proof comes from AWS, not from the agent's own claim.

[📷 UPLOAD IMAGE HERE: Node attestation sequence — proteus-node-attestation.png (SPIRE Agent claims task ARN → SPIRE Server verifies via ECS DescribeTasks + IAM allow-list → node SVID or PermissionDenied)]

### Workload attestation + admission — proving the service

Node attestation says *which task*; the admission controller says *which service identity that task may hold*. On `POST /admit`, it creates a SPIRE registration entry via the Entry API.

The seam that ties the two layers together is the entry's **`parentID`**: it's set to exactly the node SVID that `proteus_ecs` issued. So when Envoy later asks its local agent for a workload SVID over SDS, the SPIRE Server matches two things — the requesting agent's node identity against the entry's `parentID`, and the workload selectors — before minting the certificate. The controller can only grant an identity to a node the plugin already vouched for.

[📷 UPLOAD IMAGE HERE: Admission sequence — proteus-admission.png (admission controller CreateEntry → SPIRE Server → agent SDS request matched → workload SVID issued)]

So the plugin establishes *infrastructure trust* (a genuine ECS task with an approved role); the admission controller layers *application policy* on top (this task may be `service-a`). Neither alone is enough.

### Testing it — dark → admit → live

Two ECS services, `service-a` (caller) and `service-b` (callee), each with an Envoy sidecar and a co-located SPIRE Agent. Before admission, Envoy's SDS request is denied and the call fails with `503 UF`. The moment the admission controller creates the SPIRE entry, the SVID is pushed and the mTLS call succeeds.

[📷 UPLOAD IMAGE HERE: Dark vs live comparison — dark_vs_live.png]

The payoff is on the receiving side: `service-b`'s Envoy logs `peer=spiffe://proteus.local/service-a`. It didn't just accept a TLS connection — it cryptographically verified *who* was calling. No shared secret, no static cert.

[📷 UPLOAD IMAGE HERE: Live mTLS success — envoy-svc-b-obtaining-cert-from-b.png (inbound mTLS with verified peer SPIFFE ID)]

## Challenges we faced

- **No EC2 host on Fargate** — the standard `aws_iid` node attestor is out, forcing a custom `proteus_ecs` attestor built around the ECS task metadata endpoint + `DescribeTasks`.
- **Trusting the claim vs verifying it** — the agent can only *assert* a task ARN. All real verification had to live server-side, out-of-band via the ECS API, checked against an IAM-role allow-list.
- **Binding an entry to the right agent** — getting the `parentID` = node-SVID relationship right so a workload SVID can only be served to the specific task it was admitted for.
- **Deny-by-default sequencing** — node attestation must happen first (at agent startup); without a node SVID there's no `parentID` to point a workload entry at.

## Lessons learned

- On Fargate, workload identity means rethinking node attestation from scratch — there's no host to lean on, so AWS APIs (`DescribeTasks`) become the trust anchor.
- Separate the two questions cleanly: *which task* (node attestation) vs *which service identity* (admission). Conflating them makes the design impossible to reason about.
- The trust boundary shifts from *where* a service is (IP / security group) to *who* it is (a verified SPIFFE ID). That mental shift is the whole point of a zero-trust mesh.
- The port hop took me a while to internalize: the app makes a plaintext call to `localhost:9903` and Envoy transparently upgrades it to mTLS to the peer's `:9902` — the app never touches certs at all.

## Resources

- Full write-up (architecture, diagrams, and the dark → admit → live walkthrough):
  https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
- SPIFFE / SPIRE: https://spiffe.io
- Envoy SDS: https://www.envoyproxy.io/docs/envoy/latest/configuration/security/secret

---

### Image upload checklist (for the editor)

1. `proteus-container.png` — after the Vision section
2. `proteus-node-attestation.png` — after "Node attestation" text
3. `proteus-admission.png` — after "Workload attestation + admission" text
4. `dark_vs_live.png` — in the "Testing it" section
5. `envoy-svc-b-obtaining-cert-from-b.png` — after the "payoff" paragraph

Source images live in:
`public/blog/2026-08-31-spiffe-on-ecs-with-envoy/`
