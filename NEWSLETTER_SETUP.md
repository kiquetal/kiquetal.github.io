# Newsletter System — Setup Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  GitHub Actions (cron: Wed 14:00 UTC)                   │
│  1. Parses newest non-draft blog post                   │
│  2. POSTs metadata to CF Worker                         │
└───────────────────────┬─────────────────────────────────┘
                        │ POST + X-Newsletter-Secret
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker (worker-newsletter.js)               │
│  1. Validates shared secret                             │
│  2. Checks KV: "newsletter:last_sent_slug"              │
│  3. If slug == last sent → skip (no new content)        │
│  4. If slug != last sent → send via Resend → update KV  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Resend Broadcast → All subscribers in your Audience    │
└─────────────────────────────────────────────────────────┘
```

**State logic:** If you don't publish a new post before Wednesday, the same slug will match KV and the newsletter is skipped. This forces you to publish at least weekly to keep the newsletter going.

---

## 1. Create Cloudflare KV Namespace

```bash
# Create the KV namespace
wrangler kv:namespace create "NEWSLETTER_STATE"

# Copy the output ID and update wrangler_for_newsletter.toml:
# [[kv_namespaces]]
# binding = "NEWSLETTER_STATE"
# id = "<THE_ID_FROM_OUTPUT>"
```

## 2. Set Cloudflare Worker Secrets

```bash
# Deploy with the newsletter-specific wrangler config
cd /path/to/kiquetal.github.io

# Set secrets
wrangler secret put RESEND_API_KEY --config wrangler_for_newsletter.toml
wrangler secret put RESEND_SEGMENT_ID --config wrangler_for_newsletter.toml
wrangler secret put NEWSLETTER_SECRET --config wrangler_for_newsletter.toml
```

**Where to find the Segment ID:** In Resend dashboard → Audience → Segments → click your segment → the ID is in the URL or shown as "Segment ID" in the details panel. (Note: Resend deprecated "Audience ID" — Broadcasts now use `segment_id`.)

Generate a strong shared secret:
```bash
openssl rand -hex 32
```

## 3. Deploy the Worker

```bash
wrangler deploy --config wrangler_for_newsletter.toml
```

After deploying, note the worker URL (e.g., `https://kiquetal-newsletter-worker.<your-subdomain>.workers.dev`).

## 4. Set GitHub Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|---|---|
| `NEWSLETTER_WORKER_URL` | The deployed CF Worker URL |
| `NEWSLETTER_SECRET` | The same shared secret you set in step 2 |

## 5. Test Manually

Use the `workflow_dispatch` trigger:
1. Go to **Actions → Wednesday Newsletter Broadcast → Run workflow**
2. Check the logs to confirm the worker receives the request
3. First run will send the newsletter (KV is empty)
4. Second run will skip (same slug already in KV)

---

## File Overview

| File | Purpose |
|---|---|
| `worker-newsletter.js` | CF Worker: state check + Resend broadcast |
| `wrangler_for_newsletter.toml` | Wrangler config with KV binding |
| `.github/workflows/newsletter.yml` | Wednesday cron + manual dispatch |
| `worker-subscribe.js` | Existing: subscriber sign-up endpoint |

---

## How It Works Week by Week

1. You write and push a new blog post (any day)
2. Wednesday 14:00 UTC → GH Action finds newest non-draft post
3. Worker checks if that slug was already broadcast
4. **New slug** → sends email, stores slug in KV ✓
5. **Same slug** → skips, no email sent ✗

If you forget to publish → no newsletter goes out → accountability!

---

## Resend Notes

- The worker sends to `<AUDIENCE_ID>@audiences.resend.com` which broadcasts to all contacts in your Resend Audience
- Make sure your `newsletter@kiquetal.dev` domain is verified in Resend
- Unsubscribe is handled via `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder (Resend replaces this automatically)
