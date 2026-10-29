# Keeping AWS Solutions Architect Pro Current Without the Exam — the Skill Builder Maintain Path

> **AWS Builder Center draft.** Paste this into the community.aws editor.
> Wherever you see `[📷 UPLOAD IMAGE HERE: ...]`, delete that line and upload
> the named image manually at that position in the editor.
>
> **⚠️ Publish the original on kiquetal.dev FIRST** (flip `draft: false`, deploy,
> verify the live URL), then cross-post here with the canonical link set.
>
> **Title (paste into the editor's Title field):**
> Keeping AWS Solutions Architect Pro Current Without the Exam — the Skill Builder Maintain Path
>
> **Brief description / summary (paste into the editor's Description field):**
> AWS certifications expire every three years. Instead of retaking the Solutions
> Architect – Professional exam, I'm using the newer Skill Builder "Maintain"
> path: earn 700 points and complete two hands-on labs to extend the credential
> by one year. Here's how the path works, the eligibility gotchas, the point
> math, and the route I planned — documented as I go.
>
> **Canonical URL (set this in the editor):**
> https://kiquetal.dev/blog/2026-09-18-aws-recert-maintain-path
>
> **Suggested tags/topics (add in the editor):**
> `AWS Certification`, `Training and Certification`, `Solutions Architect`,
> `Skill Builder`, `Security`, `Networking`, `Career`
> (Builder Center usually expects a mix of AWS service/topic tags — lead with
> `AWS Certification` / `Training and Certification` for discoverability.)

---

## Vision

My AWS Certified Solutions Architect – Professional (SAP-C02) credential expires soon. Rather than blocking out a weekend to retake a three-hour exam, I'm taking the newer **Maintain** path on AWS Skill Builder: complete curated training and hands-on labs to extend the credential by one year.

The question that shaped my plan: **what's the most efficient route to the required points that also makes me genuinely better at Pro-level work — not just a box-ticking exercise?**

AWS certifications are valid for three years, and you can keep them current two ways:

- **Renew** — pass the latest version of the exam → **+3 years**.
- **Maintain** — complete curated training + labs on AWS Skill Builder → **+1 year**.

I chose Maintain, and I decided to aim *past* the minimum.

[📷 UPLOAD IMAGE HERE: Renew-vs-Maintain decision flowchart — renew-vs-maintain.svg]

## How the Maintain path works (the details that are easy to miss)

- **Eligibility:** available when your certification is **within 90 days of expiration** and still **active**. Expired certifications are **not** eligible — if you let it lapse, this door closes.
- **Prerequisite:** an active paid AWS Skill Builder subscription.
- **Where:** in Skill Builder, go to **Explore → Validate your skills → Recertify**, then select your certification.
- **Threshold (Professional):** earn **700 points**, including **at least two practical activities (hands-on labs)**. (Associate level needs 500 points and one lab.)
- **Result:** the certification is **extended by one year** from the completion date, and maintaining a higher cert also **extends a still-active related lower-level cert** (e.g., SA – Associate) to match.
- **Status:** currently in open **Beta**.

The two things that matter most in practice: you must start **while the cert is still active** (the 90-day window is a window, not a grace period), and the **700-point total is the binding constraint** — the two-lab minimum is the easy part.

[📷 UPLOAD IMAGE HERE: Skill Builder Recertify progress page — skillbuilder-recertify-progress.png]

## The math — planning a route to 800+

Courses are worth 40–160 points; SimuLearn labs are 100 each. Instead of grabbing points at random, I weighted my plan toward SA-Professional exam domains — architecture, networking, hybrid connectivity, and security — and deliberately targeted **800+ points**, not the bare 700:

- 4 SimuLearn labs (VPC routing conflicts, inter-region peering, securing hybrid access, securing a banking data lake) — 400 pts
- Advanced Architecting on AWS — 160 pts
- Security Engineer courses (encryption, edge security) — 180 pts
- Centralized Account Management — 80 pts

That's **820 points** with the two-lab minimum well exceeded, and every item does double duty as real study.

## How it's going (documented as I complete each item)

I track each course and lab in its own notes folder — one source of truth per item — and summarize what I learned as I finish them.

**Course 01 — Protecting and Encrypting Data.** Encryption fundamentals (symmetric vs asymmetric, hashing, certificates), the four KMS key-material origins (and the `EXTERNAL` vs `EXTERNAL_KEY_STORE` distinction), data-at-rest on S3/EBS/FSx with the "encryption is set at creation" gotcha, data-in-transit options, and Macie / CloudWatch Logs data protection.

**Course 02 — Edge Security.** Edge vs. network controls, the layered edge defense (Shield → CloudFront → WAF → API Gateway), geo-control granularity (WAF path-level vs. CloudFront distribution vs. Route 53), advanced controls (JA4 fingerprinting, CAPTCHA, Verified Access vs. Verified Permissions), IoT policies, and third-party rule integration with OCSF.

**Lab 01 — Resolve VPC Routing Conflicts.** Three peered VPCs with traffic not flowing. The lesson: peering only enables the link — routes do the work, in *both* directions (an empty return route table drops replies), and peering is not transitive.

**Lab 02 — Inter-Region Peering.** Peering two Regions' Transit Gateways: attachment + accept in the peer Region + symmetric routes, association vs. routes, and blackhole routes to explicitly deny a subnet (longest-prefix match).

## Challenges / things worth knowing

- **The 90-day-and-active rule is strict** — you cannot start Maintain once the cert has lapsed. Plan ahead.
- **Points, not labs, are the constraint** — the two-lab minimum is trivial to hit; reaching 700 (or 800) takes planning across courses and labs.
- **It's Beta** — some behaviors (does it issue a new Credly badge/email? a new downloadable certificate PDF? does the cascading lower-cert extension fire?) aren't fully documented. I'll confirm those firsthand on completion.

## Lessons learned (so far)

- Treat recertification as a **study plan, not a chore** — weighting points toward exam domains means the credential *and* the knowledge both improve.
- The hands-on SimuLearn labs are the highest-value part: a recurring theme across the networking labs is that **connectivity is routing plus explicit allow/deny, in both directions, on every hop.**
- Documenting each item as you go keeps the point total honest and turns a maintenance task into a shareable learning log.

## Resources

- Full write-up (how the path works, the point math, per-course notes and diagrams):
  https://kiquetal.dev/blog/2026-09-18-aws-recert-maintain-path
- My recert tracker repo (courses, notes, diagrams):
  https://github.com/kiquetal/recert-aws-pro-skill-builder
- AWS Certification Renewal (official): https://aws.amazon.com/certification/recertification/
- Recertify on AWS Skill Builder: https://skillbuilder.aws/certification/recertification

---

### Image upload checklist (for the editor)

1. `renew-vs-maintain.svg` — after the Vision section (the decision flowchart)
2. `skillbuilder-recertify-progress.png` — after "How the Maintain path works"

Source images live in:
`public/blog/2026-09-18-aws-recert-maintain-path/`

> **Note:** this post is a living document — I'll add course/lab summaries and a
> completion update (with the answers to the Beta open questions above) as I
> finish the route. Consider cross-posting the updated version, or link readers
> to the canonical kiquetal.dev page which stays current.
