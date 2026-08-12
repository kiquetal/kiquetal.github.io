---
title:
  en: 'Designing a zero-ops newsletter pipeline: from DNS to delivery'
  es: 'Diseñando un pipeline de newsletter sin operaciones: desde DNS hasta la entrega'
excerpt:
  en: 'How I built a self-accountability newsletter system using Cloudflare Workers, KV state machines, and Resend — with C4 architecture diagrams, idempotency guarantees, and behavioral constraints baked into infrastructure.'
  es: 'Cómo construí un sistema de newsletter con auto-accountability usando Cloudflare Workers, máquinas de estado KV y Resend — con diagramas C4, garantías de idempotencia y restricciones de comportamiento integradas en la infraestructura.'
date: 2026-08-12
tags: ['cloudflare-workers', 'resend', 'system-design', 'newsletter', 'infrastructure']
draft: false
---

<div class="lang-en">

## The Problem

Publishing consistently is hard. Not because writing is difficult, but because there's no consequence for skipping a week. I needed a system that would enforce my publishing cadence — not through willpower, but through infrastructure constraints.

The goal: **if I don't publish a new blog post before Wednesday, no newsletter goes out.** The system itself becomes the accountability mechanism.

---

## System Overview (C4 Context)

<!-- TODO: C4 Context diagram showing: User, kiquetal.dev, GitHub Actions, Cloudflare Workers, Resend, Subscribers -->

At the highest level, the system involves:

- **kiquetal.dev** — the Astro blog deployed on GitHub Pages
- **GitHub Actions** — cron trigger every Wednesday at 14:00 UTC
- **Cloudflare Workers** — three workers handling subscribe, broadcast, and notifications
- **Resend** — email delivery and audience management
- **Cloudflare KV** — state persistence for deduplication

---

## Container Diagram (C4 Level 2)

<!-- TODO: C4 Container diagram showing the three workers, KV, GH Action, Resend API -->

Three workers, each with a single responsibility:

| Worker | Responsibility | Trigger |
|---|---|---|
| `subscriber` | Add contact + send welcome email | User form submission |
| `newsletter` | Check state + broadcast if new post | GH Action (Wednesday cron) |
| `subscriber-notification` | Notify owner of audience changes | Resend webhook |

---

## The Deduplication State Machine

The core of the system is a simple state machine stored in Cloudflare KV:

```
Key:   newsletter:last_sent_slug
Value: "2026-08-08-auth-ext-middleware"
```

Every Wednesday:

1. GitHub Action parses the newest non-draft blog post
2. POSTs the slug to the newsletter worker
3. Worker reads KV: `GET newsletter:last_sent_slug`
4. **If slug matches** → skip (idempotent, no duplicate sends)
5. **If slug differs** → send broadcast via Resend → `PUT` new slug to KV

This guarantees **exactly-once delivery per post**, regardless of how many times the cron fires or retries.

---

## Security at Every Boundary

Each worker has a different trust model:

### Newsletter Worker
- **Shared secret** (`X-Newsletter-Secret` header) — only GitHub Actions can trigger it
- No public access

### Subscribe Worker  
- **CORS allowlist** — only `kiquetal.dev` and `localhost` can call it
- No authentication (public endpoint, but origin-restricted)

### Notification Worker
- **Svix HMAC-SHA256 signature verification** — cryptographically proves the request came from Resend
- **Timestamp validation** — rejects requests older than 5 minutes (replay attack prevention)

---

## DNS Infrastructure for Deliverability

<!-- TODO: Explain SPF, DKIM, DMARC records -->

Email deliverability starts at DNS. The records required:

- **SPF** — declares which servers can send email for `kiquetal.dev`
- **DKIM** — Resend signs every email; the public key lives in DNS
- **DMARC** — policy for what to do with failed authentication
- **Custom Return-Path** — bounce handling domain

---

## The Behavioral Constraint Pattern

This is the key insight: **the system doesn't remind me to publish — it simply won't work if I don't.**

Traditional approach:
> Set a reminder → feel guilty → maybe write → maybe not

Infrastructure approach:
> No new post before Wednesday → KV slug matches → newsletter skipped → subscribers get nothing → accountability through absence

The system is honest. It doesn't pretend I published. It just stays silent.

---

## Integration with the Deploy Pipeline

The full flow from writing to delivery:

1. I write a post, push to `master`
2. GitHub Pages deploys the site (existing workflow)
3. Wednesday 14:00 UTC → newsletter workflow fires
4. Action parses frontmatter of newest non-draft post
5. POSTs metadata to newsletter worker
6. Worker checks KV → sends if new → stores slug
7. Subscribers receive the broadcast

No manual intervention after the push. Zero ops.

---

## What I'd Change

- The frontmatter parser in the GitHub Action is a simple regex — a proper YAML parser would be more robust
- Welcome email uses `POST /emails` (no unsubscribe link) — could migrate to Resend Automations
- No double opt-in yet — acceptable at current scale, revisit if spam signups appear

---

## Conclusion

The best systems aren't the ones that require discipline to operate — they're the ones that make the right behavior the path of least resistance. This newsletter pipeline doesn't ask me to be consistent. It just makes inconsistency visible.

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
