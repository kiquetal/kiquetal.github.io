# LinkedIn Draft: Zero-Ops Newsletter Pipeline — Architecture and Trade-offs

> 📷 **Image Recommendation**: Attach the C4 Level 2 container diagram (c4_2_container_newsletter.png) — it shows the full system at a glance.

---
## English Version

How do you build a newsletter that costs $0/month, sends itself, and stays silent if you don't publish? 🤔

I designed a fully automated broadcast pipeline using **Cloudflare Workers**, **KV**, and **Resend**. No servers, no database, no manual steps after `git push`.

The architecture:

1️⃣ **GitHub Actions cron** fires every Wednesday, finds the newest blog post, and POSTs metadata to a Cloudflare Worker.
2️⃣ **Worker checks KV** for the last sent slug — if it matches, skip. If it differs, broadcast.
3️⃣ **Resend Broadcast API** sends to all subscribers in one call. Done.

Why this stack?

⚡ Workers over Lambda → no cold starts, KV as native binding, free 100k req/day
📧 Resend over SES → audience management built-in, no DynamoDB + Lambda loop needed
🗄️ KV over D1 → one key, one value. A SQL database for a single string? Overkill.

The idempotency mechanism is a single slug comparison. No distributed locks, no UUIDs. At weekly cadence, eventual consistency is irrelevant.

Total cost: $0. I'd need 1,000+ subscribers before paying anything.

Full write-up with C4 diagrams (Level 1→2→3), failure mode analysis, and trade-off reasoning:
👉 https://kiquetal.dev/blog/2026-08-12-newsletter-system-design

---
## Versión en Español

¿Cómo construir un newsletter que cuesta $0/mes, se envía solo, y se queda en silencio si no publicás? 🤔

Diseñé un pipeline de broadcast automatizado usando **Cloudflare Workers**, **KV** y **Resend**. Sin servidores, sin base de datos, sin pasos manuales después del `git push`.

La arquitectura:

1️⃣ **GitHub Actions cron** se ejecuta cada miércoles, encuentra el post más nuevo y envía metadata a un Cloudflare Worker.
2️⃣ **El Worker verifica KV** con el último slug enviado — si coincide, skip. Si difiere, broadcast.
3️⃣ **Resend Broadcast API** envía a todos los suscriptores en una sola llamada. Listo.

¿Por qué este stack?

⚡ Workers sobre Lambda → sin cold starts, KV nativo, 100k req/día gratis
📧 Resend sobre SES → gestión de audiencia incluida, sin necesidad de DynamoDB + Lambda
🗄️ KV sobre D1 → una key, un value. ¿Una base SQL para un string? Excesivo.

El mecanismo de idempotencia es una simple comparación de slug. Sin locks distribuidos, sin UUIDs. A cadencia semanal, la consistencia eventual es irrelevante.

Costo total: $0. Necesitaría 1,000+ suscriptores para pagar algo.

Artículo completo con diagramas C4 (Nivel 1→2→3), análisis de modos de falla y razonamiento de trade-offs:
👉 https://kiquetal.dev/blog/2026-08-12-newsletter-system-design

#CloudflareWorkers #SystemDesign #Serverless #Newsletter #Resend #Architecture #PlatformEngineering #CloudNative #SoftwareArchitecture #TradeOffs
