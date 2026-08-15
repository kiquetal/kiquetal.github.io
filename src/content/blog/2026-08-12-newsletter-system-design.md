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

If the broadcast fails, GitHub Actions marks the step as failed — but I don't actively monitor workflow runs every Wednesday. A failure could go unnoticed until I realize subscribers didn't get the email.

A future improvement: a **staleness monitor** — another lightweight worker on a cron that reads the KV slug, extracts the date from it, and alerts me if the last broadcast is older than 7 days. Something like:

```
"Hey, your last newsletter was 2 weeks ago. You stopped publishing."
```

This would catch both scenarios: I didn't publish (expected silence) and I published but the broadcast failed (unexpected silence). The system already enforces silence when I don't publish. The monitor would make that silence *loud* — turning infrastructure accountability into active feedback.

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

Quería notificar a los lectores cuando se publica un nuevo post. Ya estaba usando Resend para manejar el email del dominio, y noté que ofrecen un Broadcast API — envío masivo a un segmento de contactos en una sola llamada. Así que fui con esa idea: un newsletter completamente automatizado que no cuesta nada y no requiere intervención manual después del push.

---

## El Stack

- **Resend** — ofrece gestión de audiencia y un Broadcast API para enviar a todos los suscriptores en una llamada
- **GitHub Actions** — un cron que se ejecuta cada miércoles, detecta posts nuevos e invoca el worker de broadcast
- **Cloudflare Worker (newsletter)** — recibe metadata del post, verifica el caller, chequea duplicados y envía el broadcast
- **Cloudflare KV** — una entrada key-value para guardar el último slug enviado (guardia de idempotencia)
- **Cloudflare Worker (subscribe)** — maneja el formulario de suscripción, agrega contactos a Resend, envía email de bienvenida
- **Cloudflare Worker (notify)** — recibe webhooks de Resend cuando cambian contactos, me notifica por email

---

## Contexto del Sistema (C4 Nivel 1)

A nivel más alto, el sistema involucra dos personas, el sistema de newsletter como un todo, y dos dependencias externas:

![C4 Nivel 1 - Contexto del Sistema](/blog/2026-08-12-newsletter-system-design/c4_1_context_newsletter.png)

---

## Todos los Contenedores Trabajando Juntos (C4 Nivel 2)

Haciendo zoom, podemos ver todas las unidades desplegables y cómo se comunican a través de Resend:

![C4 Nivel 2 - Diagrama de Contenedores](/blog/2026-08-12-newsletter-system-design/c4_2_container_newsletter.png)

Tres workers, cada uno con una sola responsabilidad:

| Worker | Responsabilidad | Trigger |
|---|---|---|
| `worker-subscribe` | Agregar contacto + enviar email de bienvenida | Formulario del usuario (fetch del browser) |
| `worker-newsletter` | Verificar estado en KV + broadcast si hay post nuevo | GitHub Actions (cron miércoles) |
| `worker-notify-subscriber` | Notificarme de cambios en suscriptores | Webhook de Resend |

---

## Webhook de Notificaciones (C4 Nivel 3)

Cuando un contacto se crea, actualiza o elimina en Resend, un webhook firmado llega al worker de notificaciones. Esto es lo que pasa internamente:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_notify.png" alt="C4 Nivel 3 - worker-notify-subscriber" class="img-small" />

El elemento clave de seguridad: verificación de firma Svix HMAC-SHA256 con una ventana de timestamp de 5 minutos para prevenir replay attacks.

---

## Flujo de Suscripción (C4 Nivel 3)

Cuando un visitante envía su email desde el formulario del blog, la request va directamente al worker de suscripción:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_subscribe.png" alt="C4 Nivel 3 - worker-subscribe" class="img-small" />

La validación CORS asegura que solo requests desde `kiquetal.dev` sean aceptadas. El email de bienvenida se dispara asincrónicamente vía `ctx.waitUntil` — el suscriptor recibe una respuesta inmediata sin esperar la entrega del email.

---

## Internos del Broadcast (C4 Nivel 3)

El worker de newsletter es el más complejo — tiene autenticación, idempotencia y entrega en un solo flujo:

<img src="/blog/2026-08-12-newsletter-system-design/c4_3_component_worker_newsletter.png" alt="C4 Nivel 3 - worker-newsletter" class="img-small" />

El header de secreto compartido asegura que solo GitHub Actions pueda dispararlo. El chequeo de estado en KV previene envíos duplicados. Solo después de pasar ambas compuertas se ejecuta el broadcast.

---

## Seguridad en Cada Frontera

Cada worker tiene un modelo de confianza diferente:

**Newsletter Worker**
- Header de secreto compartido — solo GitHub Actions puede dispararlo
- Sin acceso público, sin CORS necesario

**Subscribe Worker**
- Allowlist CORS — solo `kiquetal.dev` y `localhost` pueden llamarlo
- Endpoint público, pero restringido por origen (el browser lo enforce)

**Notification Worker**
- Verificación de firma HMAC-SHA256 Svix — prueba criptográficamente que la request viene de Resend
- Validación de timestamp — rechaza requests de más de 5 minutos (prevención de replay attacks)

Tres workers, tres modelos de confianza. Sin mecanismo de auth compartido, porque cada uno tiene un caller distinto con capacidades diferentes.

---

## El Mecanismo de Deduplicación

El núcleo del sistema de broadcast es una única entrada en Cloudflare KV:

```
Key:   newsletter:last_sent_slug
Value: "2026-08-08-auth-ext-middleware"
```

Cada miércoles a las 14:00 UTC:

1. GitHub Action parsea el post más nuevo que no sea borrador
2. POST del slug al worker de newsletter
3. Worker lee KV: `GET newsletter:last_sent_slug`
4. **Si el slug coincide** → skip (ya enviado, sin duplicado)
5. **Si el slug difiere** → envía broadcast vía Resend → `PUT` nuevo slug en KV

Esto garantiza **entrega at-most-once por post**. El mecanismo es intencionalmente simple: una comparación de strings. Sin locks distribuidos, sin UUIDs, sin transaction log. A cadencia semanal, la ventana de race condition es efectivamente cero — la consistencia eventual de KV es irrelevante cuando los writes ocurren una vez por semana.

---

## Por Qué Este Stack (Trade-offs)

**Cloudflare Workers sobre AWS Lambda:**
- Free tier: 100,000 requests/día — uso ~4 por semana
- Sin cold starts (corre en el edge, siempre caliente)
- KV es un binding nativo, no necesito base de datos externa
- `ctx.waitUntil` para trabajo async fire-and-forget (Lambda necesitaría SQS/SNS)

**Resend sobre AWS SES:**
- Gestión de audiencia incluida (no construyo una base de suscriptores)
- Broadcast API envía a todo el segmento en una llamada (sin loop, sin código de batching)
- Webhooks para ciclo de vida de contactos out of the box (sin polling, sin event handling custom)
- Con SES necesitaría: DynamoDB para contactos + Lambda para iterar + SES template + bounce handling = 4x más código para el mismo resultado

**KV sobre D1 (base SQL de Cloudflare):**
- Una key, un value — una base relacional es overkill
- Consistencia eventual es aceptable a cadencia semanal
- Free tier: 100,000 reads/día + 1,000 writes/día (uso 1+1 por semana)

---

## Limitaciones y Justificaciones

**Sin retry en fallo de GitHub Actions:**
Habilitamos `workflow_dispatch` (trigger manual) para manejar esto. Si el cron del miércoles falla, puedo re-disparar manualmente. A cadencia semanal, el costo de un broadcast perdido no justifica implementar lógica de retry.

**Límites del free tier de Cloudflare Workers:**

![Límites de Cloudflare Workers](/blog/2026-08-12-newsletter-system-design/cloudlfare-worker.png)

**Límites del free tier de Resend:**

![Límites de Resend](/blog/2026-08-12-newsletter-system-design/resend-limits.png)

Números clave:
- Workers: 100,000 requests/día (uso ~4/semana)
- KV: 100,000 reads + 1,000 writes por día (uso 1+1/semana)
- Resend: 1,000 contactos marketing, broadcasts ilimitados, 100 emails transaccionales/día, 3,000/mes

**Costo mensual total: $0.** Necesitaría crecer a 1,000+ suscriptores antes de tocar algún tier pago.

---

## Qué Se Rompe y Qué Pasa

| Fallo | Qué pasa |
|---|---|
| Resend API caído durante broadcast | KV no se actualiza → el miércoles siguiente reintenta naturalmente (self-healing) |
| KV write falla después del broadcast | Email duplicado la semana siguiente — aceptable a esta escala |
| Cron de GitHub Actions no se ejecuta | Sin broadcast; re-trigger manual vía `workflow_dispatch` |
| Firma del webhook inválida | Owner no notificado — sin pérdida de datos |
| Email de bienvenida falla (ctx.waitUntil) | Suscriptor agregado, sin bienvenida — fire-and-forget por diseño |

<br>

El sistema es **self-healing por defecto**: la mayoría de los fallos se resuelven en el siguiente ciclo semanal sin intervención. El único fallo permanente es un KV write después del broadcast (envío duplicado), y a cadencia semanal con un newsletter personal, es un trade-off aceptable sobre agregar complejidad transaccional.

---

## Brecha de Observabilidad (y un Fix Futuro)

Ahora mismo sé que el sistema funcionó porque... reviso el dashboard de Resend manualmente. No es ideal.

Si el broadcast falla, GitHub Actions marca el step como fallido — pero no monitoreo activamente los workflow runs cada miércoles. Un fallo podría pasar desapercibido hasta que me doy cuenta de que los suscriptores no recibieron el email.

Una mejora futura: un **monitor de staleness** — otro worker liviano en un cron que lee el slug del KV, extrae la fecha, y me alerta si el último broadcast tiene más de 7 días. Algo como:

```
"Hey, tu último newsletter fue hace 2 semanas. Dejaste de publicar."
```

Esto atraparía ambos escenarios: no publiqué (silencio esperado) y publiqué pero el broadcast falló (silencio inesperado). El sistema ya enforce silencio cuando no publico. El monitor haría ese silencio *ruidoso* — convirtiendo accountability de infraestructura en feedback activo.

---

## Qué Cambiaría

- El parser de frontmatter en el GitHub Action es un regex — un parser YAML apropiado sería más robusto
- El email de bienvenida usa `POST /emails` (sin link de unsubscribe) — podría migrar a Resend Automations
- Sin double opt-in aún — aceptable a la escala actual, revisitar si aparecen signups spam
- Sin dashboard de observabilidad — dependo de la UI de Resend y analytics de Cloudflare, pero un endpoint `/status` sería mejor

---

## Conclusión

El objetivo era simple: notificar a los suscriptores cuando publico. La restricción era: hacerlo gratis, con cero pasos manuales después del `git push`. El resultado es un sistema que se ejecuta solo — y se queda en silencio si no publico. Ese silencio es el mecanismo de accountability.

Este diseño aguanta hasta ~1,000 suscriptores. Más allá de eso, necesitaría double opt-in para prevenir abuso, rate limiting en el worker de subscribe, y probablemente un tier pago de Resend. Pero para un blog personal? Esto es más que suficiente.

</div>
