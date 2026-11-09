# Stolen EC2 Credentials, Replayed Off-Box — and the One IAM Key That Denied Them

> **AWS Builder Center draft.** Paste this into the community.aws editor.
> Wherever you see `[📷 UPLOAD IMAGE HERE: ...]`, delete that line and upload
> the named image manually at that position in the editor.
>
> **⚠️ Publish the original on kiquetal.dev FIRST** (already `draft: false`, deploy,
> verify the live URL), then cross-post here with the canonical link set.
>
> **Title (paste into the editor's Title field):**
> Stolen EC2 Credentials, Replayed Off-Box — and the One IAM Key That Denied Them
>
> **Brief description / summary (paste into the editor's Description field):**
> An attacker stole an EC2 instance role's temporary IAM credentials and replayed
> them from their own laptop. IMDSv2 did not stop the replay — one IAM condition
> key, aws:Ec2InstanceSourceVpc, did. Here is the incident, why IMDSv2 isn't
> enough on its own, the trade-offs of VPC-binding instance credentials, and the
> question I keep asking AWS: why is this opt-in instead of the default?
>
> **Canonical URL (set this in the editor):**
> https://kiquetal.dev/blog/2026-11-09-vpc-bound-instance-credentials
>
> **Suggested tags/topics (add in the editor):**
> `Security`, `Identity and Access Management (IAM)`, `Amazon EC2`, `Networking`,
> `Security, Identity, & Compliance`, `DevOps`
> (Lead with `Security` / `IAM` for discoverability.)

---

## The incident in one picture

An attacker stole an EC2 instance's temporary AWS credentials and used them from their own laptop. One IAM condition key shut that down completely. This is the incident, the control that actually worked, its trade-offs, and a question about AWS defaults I can't stop asking.

[📷 UPLOAD IMAGE HERE: Attack-flow diagram — attack-flow-vpc-bound.svg]

The short version: the credentials were stolen successfully. What saved us was not stopping the theft — it was making the stolen credentials **worthless the moment they left the network**.

## What happened

Two steps, textbook pattern:

1. **Theft.** A compromised EC2 instance leaked its temporary IAM role credentials — the `ASIA…` STS keys that AWS vends through the Instance Metadata Service (IMDS) at `169.254.169.254`. Any code with execution on the box can read them.
2. **Replay.** The attacker took those keys and called the AWS API from an external, non-AWS IP — their own machine. This is the pattern GuardDuty labels `InstanceCredentialExfiltration.OutsideAWS`.

Temporary instance credentials are not short-lived enough to save you here. The STS keys IMDS vends are valid for hours and are auto-rotated — so an attacker who keeps reading IMDS keeps getting fresh keys. "They expire" is not a defense.

## Why "just enforce IMDSv2" is not enough

The reflexive advice when instance credentials leak is "enforce IMDSv2." We had IMDSv2. Here is the uncomfortable truth about what it does and does not do.

IMDSv2 changes how you *talk to the metadata endpoint*: it requires a session token obtained with a `PUT` before any `GET`, and it enforces a hop limit so a request bounced through a proxy (classic SSRF) can't reach IMDS. That is real and worth having.

But it only raises the bar on **stealing**:

- It blocks *simple SSRF* — the "trick the app into fetching the metadata URL" class of bug.
- It does **nothing** once an attacker has code execution on the instance. A web shell or an RCE can perform the `PUT` + `GET` dance exactly like the SDK does.
- It does **nothing** once the credentials are already off the box. The replay from the attacker's laptop never touches IMDS at all.

So IMDSv2 is necessary, not sufficient. It narrows the ways credentials get *stolen*. It does not touch the ways stolen credentials get *used*.

## How IMDSv2 actually works — and the hop limit

It's worth being precise about *how* IMDSv2 raises the bar, because the mechanism is the reason it stops SSRF but nothing downstream.

[📷 UPLOAD IMAGE HERE: IMDSv2 token handshake + hop-limit explainer — imdsv2-hop-limit.svg]

**The token handshake.** IMDSv1 answered a single unauthenticated `GET`. IMDSv2 requires two steps:

1. `PUT /latest/api/token` → IMDS returns a session token (TTL up to 6 hours).
2. `GET /latest/meta-data/iam/security-credentials/<role>` **with** that token in the `X-aws-ec2-metadata-token` header → IMDS returns the credentials.

A reflected-URL SSRF can usually only do a blind `GET`. It can't do the `PUT`-first dance, and a `GET` without the token header fails. That single change kills the classic "fetch `http://169.254.169.254/...`" SSRF.

**The hop limit.** The IMDS *response* leaves the metadata service with its IP **TTL** set to the configured hop limit (default `1`). Every network hop the packet crosses decrements TTL by one; when TTL hits `0`, the packet is dropped.

- An app reading IMDS **directly** on the instance crosses zero extra hops — the reply arrives with TTL still positive and is delivered.
- An SSRF that bounces the request **through a proxy, NAT, or an extra network boundary** forces the reply across one more hop. With hop limit `1`, TTL decrements to `0` at that hop and the reply is **dropped before it reaches the attacker**.

Practical guidance: set the hop limit to `1` for workloads that read IMDS directly. Containers whose traffic routes through the host network namespace sometimes need `2` — set it as low as your topology allows, and no lower.

The crucial caveat, and the bridge to the rest of this post: **the hop limit is an SSRF / exfil-path control, not a replay control.** Once the credentials are already off the box — in the attacker's hands on their own machine — the hop limit is irrelevant. That gap is exactly what the next section closes.

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

Read it as: *"If these are EC2 instance credentials (the key is present) and the request's source VPC is not the VPC that issued them, deny everything."*

`aws:Ec2InstanceSourceVpc` carries the VPC ID of the VPC in which the instance that was issued the credentials runs. AWS populates it **automatically on every credential issued to an EC2 instance** — you don't configure the instance to emit it. When the attacker replayed the keys from outside that VPC, the source VPC no longer matched, the deny fired, and **every call was blocked**.

The two `Condition` operators matter:

- `StringNotEquals` — deny when the source VPC is anything other than the issuing VPC.
- `Null: "false"` — only apply this deny when the key *exists*. Without it, the policy would also deny credentials that aren't EC2 instance credentials at all (users, other roles), because the key would be absent and "absent ≠ my VPC" evaluates true. This guard scopes the deny to instance credentials only.

## The implementation nuance that matters

There are three similar-looking condition keys, and picking the wrong one silently does nothing:

- `aws:SourceVpc` and `aws:SourceVpce` only populate for traffic that arrives **over a VPC endpoint (PrivateLink)**. If your workload calls public AWS API endpoints — which most do by default — these keys are simply absent, your condition never matches the way you expect, and you get a false sense of protection. They describe the *network path of this request*, not the credential.
- `aws:Ec2InstanceSourceVpc` is bound to the **instance credential itself** and populates regardless of the network path. That is exactly why it was the right key for an off-box replay: it does not care whether the attacker went through an endpoint or the public internet — it only cares which VPC issued the keys.

There is a sibling key, `aws:Ec2InstanceSourcePrivateIPv4`, carrying the instance's primary private IP. You can layer it on to pin credentials to a single instance's IP, but VPC-level binding was the right blast radius here.

## Trade-offs: what VPC-binding costs you

This is not free, and it is not right for every workload. Honest trade-offs:

- **Legitimate off-box use breaks too.** If any real workflow uses instance credentials from outside the issuing VPC — cross-VPC without PrivateLink, an on-prem job assuming the instance role, a CI runner — this deny breaks it. The control cannot tell "attacker off-box" from "my pipeline off-box." Inventory those paths first.
- **Multi-VPC / multi-account needs a set, not a single value.** A fleet spread across several VPCs needs the condition to allow a *list* of VPC IDs (or be applied per-VPC via SCP/boundary). That list becomes config you keep in sync as VPCs are created and retired.
- **VPC peering and Transit Gateway don't change the issuing VPC.** The key reflects the VPC that *issued* the credential, not reachability. Traffic riding a peering connection from another VPC still carries that other VPC's source, so it is denied — usually what you want, but it surprises teams who think "peered = same network."
- **It is a deny, so debugging is a cliff.** When it misfires, calls fail with `AccessDenied` and no hint about *why*. Wire up CloudTrail and a dashboard for the deny before you roll it out.
- **Placement matters.** As an SCP it covers a whole OU but can't name a single VPC cleanly across accounts; as a role trust/permission boundary it is precise but must be attached to every role. Pick the layer deliberately.

Despite all that, for the common case — an instance role used only by the instance, inside its own VPC — the downside is close to zero and the upside is that off-box replay simply stops working.

## IMDSv2 vs the condition key

| Aspect | IMDSv2 | `aws:Ec2InstanceSourceVpc` deny |
|--------|--------|--------------------------------|
| **What it protects** | How credentials are *stolen* | How stolen credentials are *used* |
| **Stops simple SSRF** | Yes | N/A (not its job) |
| **Stops theft after code execution (RCE/web shell)** | No | N/A |
| **Stops off-box replay** | No | Yes |
| **Depends on network path** | No | No (bound to credential) |
| **Config effort** | Instance / launch-template setting | IAM policy / SCP authored by you |
| **Breaks legit off-box use** | No | Yes — inventory first |
| **Default in AWS?** | Now default on new instances | Opt-in only |

The row that matters: these controls act in **different places**. IMDSv2 is upstream (theft), the condition key is downstream (use). You want both — they are not substitutes.

## The question: why is this opt-in, not the default?

AWS **already knows** which VPC issued the credential — that's the whole reason the key can exist and be auto-populated. The information is right there in the request context on every single call.

So why are instance-role credentials not VPC-bound **by default**?

Making off-box replay fail by default would eliminate the `InstanceCredentialExfiltration.OutsideAWS` class of attack for the vast majority of workloads, where the instance role is only ever used by the instance anyway. The downside for that majority is essentially zero. Instead it ships as an opt-in condition key launched in March 2023 that most teams have never heard of.

I understand the counter-argument — a hard default would break the minority of workloads that legitimately use instance credentials off-box, and AWS is allergic to breaking changes. But "secure by default with a documented opt-out" is a posture AWS has adopted before (IMDSv2 itself is now default on new instances; S3 Block Public Access; EBS encryption by default). Credential VPC-binding feels like it belongs in that same category.

Why is this opt-in instead of opt-out, AWS?

## Resources

- Full bilingual write-up (diagram, policy, trade-offs, comparison table):
  https://kiquetal.dev/blog/2026-11-09-vpc-bound-instance-credentials
- AWS What's New — IAM Roles for Amazon EC2 credential control properties (launched 2023-03-06):
  https://aws.amazon.com/about-aws/whats-new/2023/03/iam-roles-amazon-ec2-credential-control-properties/
- AWS Security Blog — How to use policies to restrict where EC2 instance credentials can be used from:
  https://aws.amazon.com/blogs/security/how-to-use-policies-to-restrict-where-ec2-instance-credentials-can-be-used-from/
- AWS global condition context keys:
  https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html
- hackingthe.cloud — Bypass Credential Exfiltration Detection:
  https://hackingthe.cloud/aws/avoiding-detection/steal-keys-undetected/

> Casing note: AWS docs write the key as `aws:EC2InstanceSourceVPC`. IAM condition-key matching is case-insensitive, so `aws:Ec2InstanceSourceVpc` (used above) is equivalent and valid.
>
> Public-safe: no account IDs, instance IDs, attacker IPs, or access keys appear here — the VPC ID is a placeholder. Incident specifics stay in the private report.

---

### Image upload checklist (for the editor)

1. `attack-flow-vpc-bound.svg` — right after the "incident in one picture" intro.
2. `imdsv2-hop-limit.svg` — in the "How IMDSv2 actually works" section.

Source image lives in:
`public/blog/2026-11-09-vpc-bound-instance-credentials/`

> **Tip:** if the Builder Center editor won't accept an SVG upload, export a PNG
> first with `python superdesign/screenshot.py` (or any SVG→PNG tool) and upload
> that instead.
