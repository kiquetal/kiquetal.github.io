---
title:
  en: 'Designing a zero-ops newsletter pipeline: architecture and trade-offs'
  es: 'Diseñando un pipeline de newsletter sin operaciones: arquitectura y trade-offs'
excerpt:
  en: 'How I built a self-accountability newsletter system using Cloudflare Workers, KV state machines, and Resend — with C4 architecture diagrams, idempotency guarantees, and behavioral constraints baked into infrastructure.'
  es: 'Cómo construí un sistema de newsletter con auto-accountability usando Cloudflare Workers, máquinas de estado KV y Resend — con diagramas C4, garantías de idempotencia y restricciones de comportamiento integradas en la infraestructura.'
date: 2026-08-12
updated: 2026-08-15
tags: ['cloudflare-workers', 'resend', 'system-design', 'newsletter', 'infrastructure']
draft: false
---

<div class="lang-en">

## The Problem

I wanted to notify readers when a new blog post is published. I was already using Resend to manage email for this domain, and I noticed they offer a Broadcast API — bulk email to a segment of contacts in a single call. So I went with that idea: a fully automated newsletter that costs nothing to run and requires zero intervention after I push a post.

---

## The Stack

- **Resend** — offers audience management and a Broadcast API to send to all subscribers in one call
- **GitHub Actions** — a cron job that triggers every Wednesday, detects new posts, and invokes the broadcast worker
- **Cloudflare Worker (newsletter)** — receives post metadata, verifies the caller, checks for duplicates, and sends the broadcast
- **Cloudflare KV** — a single key-value entry to store the last sent slug (idempotency guard)
- **Cloudflare Worker (subscribe)** — handles the subscription form, adds contacts to Resend, sends a welcome email
- **Cloudflare Worker (notify)** — receives Resend webhooks when contacts change, notifies me via email

---

## System Context (C4 Level 1)

At the highest level, the system involves two people, the newsletter system as a whole, and two external dependencies:

![C4 Level 1 - System Context](/blog/2026-08-12-newsletter-system-design/c4_1_context_newsletter.png)

---

## All Containers Working Together (C4 Level 2)

Zooming in, we can see all the deployable units and how they communicate through Resend:

![C4 Level 2 - Container Diagram](/blog/2026-08-12-newsletter-system-design/c4_2_container_newsletter.png)

Three workers, each with a single responsibility:

| Worker | Responsibility | Trigger |
|---|---|---|
| `worker-subscribe` | Add contact + send welcome email | User form submission (browser fetch) |
| `worker-newsletter` | Check KV state + broadcast if new post | GitHub Actions (Wednesday cron) |
| `worker-notify-subscriber` | Notify me of subscriber changes | Resend webhook |

---

## Webhook Notifications (C4 Level 3)

When a contact is created, updated, or deleted in Resend, a signed webhook hits the notify worker. Here's what happens inside:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_notify.png" alt="C4 Level 3 - worker-notify-subscriber" class="img-small" />

The key security element: Svix HMAC-SHA256 signature verification with a 5-minute timestamp window to prevent replay attacks.

---

## Subscription Flow (C4 Level 3)

When a visitor submits their email from the blog form, the request goes directly to the subscribe worker:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_subscribe.png" alt="C4 Level 3 - worker-subscribe" class="img-small" />

CORS validation ensures only requests from `kiquetal.dev` are accepted. The welcome email fires asynchronously via `ctx.waitUntil` — the subscriber gets an immediate response without waiting for email delivery.

---

## Broadcast Internals (C4 Level 3)

The newsletter worker is the most complex — it has auth, idempotency, and delivery in one flow:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_newsletter.png" alt="C4 Level 3 - worker-newsletter" class="img-small" />

The shared secret header ensures only GitHub Actions can trigger it. The KV state check prevents duplicate sends. Only after both gates pass does the broadcast fire.

---

## Security at Every Boundary

Each worker has a different trust model:

**Newsletter Worker**
- Shared secret header — only GitHub Actions can trigger it
- No public access, no CORS needed

**Subscribe Worker**
- CORS allowlist — only `kiquetal.dev` and `localhost` can call it
- Public endpoint, but origin-restricted (browser enforces this)

**Notification Worker**
- Svix HMAC-SHA256 signature verification — cryptographically proves the request came from Resend
- Timestamp validation — rejects requests older than 5 minutes (replay attack prevention)

Three workers, three trust models. No shared auth mechanism, because each has a different caller with different capabilities.

---

## The Deduplication Mechanism

The core of the broadcast system is a single entry in Cloudflare KV:

```
Key:   newsletter:last_sent_slug
Value: "2026-08-08-auth-ext-middleware"
```

Every Wednesday at 14:00 UTC:

1. GitHub Action parses the newest non-draft blog post
2. POSTs the slug to the newsletter worker
3. Worker reads KV: `GET newsletter:last_sent_slug`
4. **If slug matches** → skip (already sent, no duplicate)
5. **If slug differs** → send broadcast via Resend → `PUT` new slug to KV

This guarantees **at-most-once delivery per post**. The mechanism is intentionally simple: a single string comparison. No distributed locks, no UUIDs, no transaction log. At weekly cadence, the race condition window is effectively zero — KV eventual consistency is irrelevant when writes happen once per week.

---

## Why This Stack (Trade-offs)

**Cloudflare Workers over AWS Lambda:**
- Free tier: 100,000 requests/day — I use ~4 per week
- No cold starts (runs at the edge, always warm)
- KV is a native binding, no external database needed
- `ctx.waitUntil` for fire-and-forget async work (Lambda would need SQS/SNS)

**Resend over AWS SES:**
- Audience management built-in (I don't build a subscriber database)
- Broadcast API sends to the whole segment in one call (no loop, no batching code)
- Webhooks for contact lifecycle out of the box (no polling, no custom event handling)
- With SES I'd need: DynamoDB for contacts + Lambda to iterate + SES template + bounce handling = 4x more code for the same result

**KV over D1 (Cloudflare's SQL database):**
- One key, one value — a relational database is overkill
- Eventual consistency is acceptable at weekly cadence
- Free tier: 100,000 reads/day + 1,000 writes/day (I use 1+1 per week)

---

## Limitations and Justifications

**No retry on GitHub Actions failure:**
We enabled `workflow_dispatch` (manual trigger) to handle this. If the Wednesday cron fails, I can re-trigger manually. At weekly cadence, the cost of one missed broadcast doesn't justify implementing retry logic.

**Cloudflare Workers free tier limits:**

![Cloudflare Workers Limits](/blog/2026-08-12-newsletter-system-design/cloudlfare-worker.png)

**Resend free tier limits:**

![Resend Limits](/blog/2026-08-12-newsletter-system-design/resend-limits.png)

Key numbers:
- Workers: 100,000 requests/day (I use ~4/week)
- KV: 100,000 reads + 1,000 writes per day (I use 1+1/week)
- Resend: 1,000 marketing contacts, unlimited broadcasts, 100 transactional emails/day, 3,000/month

**Total monthly cost: $0.** I would need to grow to 1,000+ subscribers before hitting any paid tier.

---

## What Breaks and What Happens

| Failure | What happens |
|---|---|
| Resend API down during broadcast | KV not updated → next Wednesday retries naturally (self-healing) |
| KV write fails after broadcast | Duplicate email next week — acceptable at this scale |
| GitHub Actions cron doesn't fire | No broadcast; manual re-trigger via `workflow_dispatch` |
| Webhook signature invalid | Owner not notified — no data loss |
| Welcome email fails (ctx.waitUntil) | Subscriber added, no welcome — fire-and-forget by design |

<br>

The system is **self-healing by default**: most failures resolve on the next weekly cycle without intervention. The only permanent failure is a KV write after broadcast (duplicate send), and at weekly cadence with a personal newsletter, that's an acceptable trade-off over adding transaction complexity.

---

## Observability Gap (and a Future Fix)

Right now I know the system worked because... I check Resend's dashboard manually. That's not great.

A future improvement: a **staleness monitor** — another lightweight worker on a cron that reads the KV slug, extracts the date from it, and alerts me if the last broadcast is older than 7 days. Something like:

```
"Hey, your last newsletter was 2 weeks ago. You stopped publishing."
```

The system already enforces silence when I don't publish. The monitor would make that silence *loud* — turning infrastructure accountability into active feedback.

---

## What I'd Change

- The frontmatter parser in the GitHub Action is a regex — a proper YAML parser would be more robust
- The welcome email uses `POST /emails` (no unsubscribe link) — could migrate to Resend Automations
- No double opt-in yet — acceptable at current scale, revisit if spam signups appear
- No observability dashboard — I rely on Resend's UI and Cloudflare analytics, but a `/status` endpoint would be better

---

## Conclusion

The goal was simple: notify subscribers when I publish. The constraint was: do it for free, with zero manual steps after `git push`. The result is a system that runs itself — and stays silent if I don't publish. That silence is the accountability mechanism.

This design holds until ~1,000 subscribers. Beyond that, I'd need double opt-in to prevent abuse, rate limiting on the subscribe worker, and probably a paid Resend tier. But for a personal blog? This is more than enough.

</div>



<div class="lang-es">

## El Problema

Publicar consistentemente es difícil. No porque escribir sea complicado, sino porque no hay consecuencias por saltarse una semana. Necesitaba un sistema que impusiera mi cadencia de publicación — no a través de fuerza de voluntad, sino a través de restricciones de infraestructura.

El objetivo: **si no publico un nuevo post antes del miércoles, no se envía newsletter.** El sistema mismo se convierte en el mecanismo de accountability.

---

## Visión General del Sistema (C4 Contexto)

<!-- TODO: Diagrama C4 de Contexto -->

A nivel más alto, el sistema involucra:

- **kiquetal.dev** — el blog Astro desplegado en GitHub Pages
- **GitHub Actions** — trigger cron cada miércoles a las 14:00 UTC
- **Cloudflare Workers** — tres workers manejando suscripción, broadcast y notificaciones
- **Resend** — entrega de emails y gestión de audiencia
- **Cloudflare KV** — persistencia de estado para deduplicación

---

## Diagrama de Contenedores (C4 Nivel 2)

<!-- TODO: Diagrama C4 de Contenedores -->

Tres workers, cada uno con una sola responsabilidad:

| Worker | Responsabilidad | Trigger |
|---|---|---|
| `subscriber` | Agregar contacto + enviar email de bienvenida | Formulario del usuario |
| `newsletter` | Verificar estado + broadcast si hay post nuevo | GH Action (cron miércoles) |
| `subscriber-notification` | Notificar al owner de cambios en audiencia | Webhook de Resend |

---

## La Máquina de Estado de Deduplicación

El núcleo del sistema es una máquina de estado simple almacenada en Cloudflare KV:

```
Key:   newsletter:last_sent_slug
Value: "2026-08-08-auth-ext-middleware"
```

Cada miércoles:

1. GitHub Action parsea el post más nuevo que no sea borrador
2. POST del slug al worker de newsletter
3. Worker lee KV: `GET newsletter:last_sent_slug`
4. **Si el slug coincide** → skip (idempotente, sin envíos duplicados)
5. **Si el slug difiere** → envía broadcast vía Resend → `PUT` nuevo slug en KV

Esto garantiza **entrega exactly-once por post**, sin importar cuántas veces el cron se ejecute o reintente.

---

## Seguridad en Cada Frontera

Cada worker tiene un modelo de confianza diferente:

### Newsletter Worker
- **Secreto compartido** (header `X-Newsletter-Secret`) — solo GitHub Actions puede dispararlo
- Sin acceso público

### Subscribe Worker
- **Allowlist CORS** — solo `kiquetal.dev` y `localhost` pueden llamarlo
- Sin autenticación (endpoint público, pero restringido por origen)

### Notification Worker
- **Verificación de firma HMAC-SHA256 Svix** — prueba criptográficamente que la request viene de Resend
- **Validación de timestamp** — rechaza requests de más de 5 minutos (prevención de replay attacks)

---

## Infraestructura DNS para Deliverability

<!-- TODO: Explicar registros SPF, DKIM, DMARC -->

La deliverability de emails empieza en DNS. Los registros requeridos:

- **SPF** — declara qué servidores pueden enviar email por `kiquetal.dev`
- **DKIM** — Resend firma cada email; la clave pública vive en DNS
- **DMARC** — política para qué hacer con autenticación fallida
- **Custom Return-Path** — dominio de manejo de bounces

---

## El Patrón de Restricción de Comportamiento

Este es el insight clave: **el sistema no me recuerda publicar — simplemente no funciona si no lo hago.**

Enfoque tradicional:
> Poner un recordatorio → sentir culpa → quizás escribir → quizás no

Enfoque de infraestructura:
> Sin post nuevo antes del miércoles → slug en KV coincide → newsletter se salta → suscriptores no reciben nada → accountability a través de la ausencia

El sistema es honesto. No pretende que publiqué. Simplemente se queda en silencio.

---

## Integración con el Pipeline de Deploy

El flujo completo desde escritura hasta entrega:

1. Escribo un post, push a `master`
2. GitHub Pages despliega el sitio (workflow existente)
3. Miércoles 14:00 UTC → workflow de newsletter se ejecuta
4. Action parsea frontmatter del post más nuevo sin draft
5. POST de metadata al worker de newsletter
6. Worker verifica KV → envía si es nuevo → almacena slug
7. Suscriptores reciben el broadcast

Sin intervención manual después del push. Zero ops.

---

## Qué Cambiaría

- El parser de frontmatter en el GitHub Action es un regex simple — un parser YAML apropiado sería más robusto
- El email de bienvenida usa `POST /emails` (sin link de unsubscribe) — podría migrar a Resend Automations
- Sin double opt-in aún — aceptable a la escala actual, revisitar si aparecen signups spam

---

## Conclusión

Los mejores sistemas no son los que requieren disciplina para operar — son los que hacen que el comportamiento correcto sea el camino de menor resistencia. Este pipeline de newsletter no me pide ser consistente. Solo hace que la inconsistencia sea visible.

</div>
