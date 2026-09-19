---
title:
  en: 'Keeping AWS Solutions Architect Pro current without the exam: the Skill Builder Maintain path'
  es: 'Manteniendo mi AWS Solutions Architect Pro sin reexamen: la ruta Maintain de Skill Builder'
excerpt:
  en: 'AWS certifications expire every three years. Instead of retaking the SA-Professional exam, I am using the Skill Builder "Maintain" path — earning 700 points and two hands-on labs to extend the credential by one year. Here is how the path works, the eligibility gotchas, and the curated route I planned to reach 700.'
  es: 'Las certificaciones de AWS caducan cada tres años. En lugar de volver a rendir el examen SA-Professional, estoy usando la ruta "Maintain" de Skill Builder — sumando 700 puntos y dos laboratorios prácticos para extender la credencial un año. Aquí explico cómo funciona la ruta, los detalles de elegibilidad y la ruta que planifiqué para llegar a 700.'
date: 2026-09-18
updated: 2026-09-18
tags: ['aws', 'certification', 'aws-pro', 'solutions-architect', 'skill-builder', 'recertification']
draft: true
---

<div class="lang-en">

My **AWS Certified Solutions Architect – Professional (SAP-C02)** credential
expires on **2026-12-13**. Rather than blocking out a weekend to retake a
three-hour exam, I am taking the newer **Maintain** path on AWS Skill Builder:
complete curated training and hands-on labs to extend the credential by one
year. This post explains how that path works, the eligibility details that are
easy to miss, and the study plan I put together to hit the required 700 points.

**Contents**

- [Two ways to keep a certification current](#two-ways)
- [How the Maintain path works](#how-it-works)
- [The math: planning a route to 700](#the-math)
- [Tracking progress](#progress)
- [Course 01: Protecting and Encrypting Data](#course-01)
- [Why write this down](#why)

<h2 id="two-ways">Two ways to keep a certification current</h2>

<img src="/blog/2026-09-18-aws-recert-maintain-path/renew-vs-maintain.svg" alt="Decision flowchart: an expiring AWS certification branches into Renew (pass the latest exam, +3 years) or Maintain (700 points plus 2 labs on Skill Builder within 90 days of expiry, +1 year), where Maintain also extends a related lower-level certification" class="img-small" />

AWS certifications are valid for three years. You can keep them current in two
ways:

1. **Renew** — pass the latest version of the exam. Extends the credential by
   **+3 years**.
2. **Maintain** — complete curated training plus labs on AWS Skill Builder.
   Extends the credential by **+1 year**. This is the path I am using.

The trade-off is straightforward: Renew buys you three years but costs you a
full exam sitting; Maintain buys you one year for a few hours of self-paced
learning. Since I recently went deep on security topics (I just passed the
Security Specialty), the Maintain path lets me keep the Pro credential current
while continuing to learn in the same domain, without the exam overhead.

<h2 id="how-it-works">How the Maintain path works</h2>

These are the mechanics, verified against official AWS sources:

- **Eligibility:** available when your certification is **within 90 days of
  expiration** and still **active**. Expired certifications are **not**
  eligible — if you let it lapse, Maintain is off the table.
- **Prerequisite:** an **active paid AWS Skill Builder subscription**
  (Individual monthly/annual, or Team).
- **Where:** in Skill Builder, go to **Explore → Validate your skills →
  Recertify**, then select **Solutions Architect – Professional**.
- **Threshold (Professional):** earn **700 points**, including **at least two
  practical activities (hands-on labs)**. (The Associate level requires 500
  points and at least one lab.)
- **Pace:** self-paced; finish everything **before your certification
  expires**.
- **Result:** the certification is **extended by one year** from the
  completion date.
- **Cascading extension:** maintaining SA – Professional also extends a
  still-active related lower-level cert (for example SA – Associate) to match
  the new expiration date.
- **Status:** this maintenance experience is currently in open **Beta**.

The two details that matter most in practice: you must start **while the cert is
still active** (the 90-day window is a window, not a grace period), and the
**700-point total is the binding constraint** — the two-lab minimum is easy to
hit, but reaching 700 takes planning.

<h2 id="the-math">The math: planning a route to 700</h2>

Courses on the recert path are worth anywhere from 40 to 160 points; the
SimuLearn labs are worth 100 each. Rather than grab points at random, I weighted
my plan toward SA-Professional exam domains — architecture, networking, hybrid
connectivity, and security — so the points do double duty as real study.

Here is the route I planned. The recertification only *requires* two labs and
700 points, but Skill Builder flags four SimuLearn labs as the highest-value
practice for SA-Professional domains — complex networking, hybrid connectivity,
multi-region, and data security. Since the point of this is to actually get
better, not just to tick the box, I chose to do all four and aim past the
minimum, for a target of **at least 800 points**:

| Item                                                                   | Type   | Points |
| ---------------------------------------------------------------------- | ------ | ------ |
| AWS SimuLearn: Resolve VPC Routing Conflicts                           | Lab    | 100    |
| AWS SimuLearn: Inter-Region Peering                                    | Lab    | 100    |
| AWS SimuLearn: Securing Hybrid Access                                  | Lab    | 100    |
| AWS SimuLearn: Securing a Banking Data Lake                            | Lab    | 100    |
| Advanced Architecting on AWS - Online Course Supplement                | Course | 160    |
| AWS Security Engineer - Edge Security                                  | Course | 100    |
| AWS Security Engineer - Protecting and Encrypting Data                 | Course | 80     |
| AWS Security Engineer - Centralized Account Management                 | Course | 80     |
| **Total**                                                              |        | **820** |

That is 820 points — well over the 700 minimum — with the two-lab requirement
exceeded (four labs). I added **Centralized Account Management** to clear 800:
multi-account governance (AWS Organizations, SCPs) is a core SA-Professional
domain, so it earns its place on learning value, not just points. The route
leans deliberately toward hands-on activities because that is where the real
learning is, and the nice property of this planning is that items are swappable
— the point total is the binding constraint, so you can trade one item for
another as long as the total holds.

<h2 id="progress">Tracking progress</h2>

Once enrolled, you work toward the minimum points; Skill Builder shows a live
progress bar against the 700-point threshold and the two-lab requirement:

![AWS Skill Builder Recertify page for Solutions Architect – Professional, showing points progress against the 700-point threshold and the two-lab practical requirement](/blog/2026-09-18-aws-recert-maintain-path/skillbuilder-recertify-progress.png)

I track each course in its own notes folder — one source of truth per course —
and record what I learned in the sections below as I complete them.

<h2 id="course-01">Course 01: Protecting and Encrypting Data (done)</h2>

The first course I finished, **AWS Security Engineer: Protecting and Encrypting
Data** (80 points, ~1h), was a solid refresher on data protection across the
AWS stack. The parts worth remembering:

- **Encryption fundamentals** — symmetric (same key to encrypt and decrypt) vs
  asymmetric (a key pair: one encrypts, the other decrypts); hashing as a
  *one-way* operation for integrity, not confidentiality; and digital
  certificates as identity proof via public-key cryptography.
- **KMS key material origins** — the distinction between the KMS *key* (the
  object you control) and the *key material* (the bytes that do the crypto),
  and the four origins: `AWS_KMS` (default), `EXTERNAL` (you import material,
  but it ends up inside KMS), `AWS_CLOUDHSM`, and `EXTERNAL_KEY_STORE` / XKS
  (material never enters AWS; crypto is proxied out). The confusing pair is
  `EXTERNAL` vs `EXTERNAL_KEY_STORE`: import-into-KMS vs stays-outside-forever.
- **Data at rest** — S3 encryption (SSE-S3 / SSE-KMS / SSE-C) and the S3 Bucket
  Key cost optimization; the gotcha that EBS/FSx encryption and KMS key are set
  **at creation** (re-keying means snapshot-copy or backup→restore, never
  in place); S3 Object Lock (WORM) in Governance vs Compliance modes; and
  lifecycle/retention across S3, EFS, and FSx.
- **Data in transit** — choosing between PrivateLink, Client VPN, Verified
  Access (zero-trust, no VPN), Site-to-Site VPN, Direct Connect (not encrypted
  on its own — add VPN/MACsec), and Nitro instance-to-instance encryption.
- **Discovery & masking** — Macie for sensitive-data discovery in S3, and
  CloudWatch Logs data protection policies that mask PII/credentials at
  ingestion (guarded by the `logs:Unmask` permission).

Services covered: **KMS, ACM, S3 encryption, Secrets Manager, Macie**. Full
notes and diagrams live in the course's folder in my recert tracker repo.

<h2 id="why">Why write this down</h2>

Most AWS certification content is about *passing* exams. The Maintain path is
newer, still in Beta, and under-documented — so the eligibility rules and the
point math are genuinely hard to find in one place. Writing it down keeps me
accountable to the plan, and hopefully saves someone else the time of piecing
the rules together.

I will follow up when the credential is extended, with notes on which courses
and labs were actually worth the time.

### References

- [AWS Certification Renewal (official)](https://aws.amazon.com/certification/recertification/)
- [A new way to keep your AWS Certification current (announcement)](https://aws.amazon.com/blogs/training-and-certification/a-new-way-to-keep-your-aws-certification-current/)
- [Recertify on AWS Skill Builder](https://skillbuilder.aws/certification/recertification)

</div>

<div class="lang-es">

Mi credencial **AWS Certified Solutions Architect – Professional (SAP-C02)**
caduca el **2026-12-13**. En lugar de reservar un fin de semana para volver a
rendir un examen de tres horas, estoy usando la ruta más reciente **Maintain**
de AWS Skill Builder: completar formación curada y laboratorios prácticos para
extender la credencial un año. Este post explica cómo funciona esa ruta, los
detalles de elegibilidad que es fácil pasar por alto, y el plan de estudio que
armé para alcanzar los 700 puntos requeridos.

**Contenido**

- [Dos formas de mantener vigente una certificación](#dos-formas)
- [Cómo funciona la ruta Maintain](#como-funciona)
- [La matemática: planificar una ruta hacia 700](#la-matematica)
- [Seguimiento del progreso](#progreso)
- [Curso 01: Protecting and Encrypting Data](#curso-01)
- [Por qué documentarlo](#por-que)

<h2 id="dos-formas">Dos formas de mantener vigente una certificación</h2>

<img src="/blog/2026-09-18-aws-recert-maintain-path/renew-vs-maintain.svg" alt="Diagrama de decisión: una certificación de AWS por vencer se bifurca en Renew (aprobar el último examen, +3 años) o Maintain (700 puntos más 2 laboratorios en Skill Builder dentro de los 90 días previos al vencimiento, +1 año), donde Maintain también extiende una certificación de nivel inferior relacionada" class="img-small" />

Las certificaciones de AWS son válidas por tres años. Puedes mantenerlas
vigentes de dos formas:

1. **Renew (Renovar)** — aprobar la última versión del examen. Extiende la
   credencial **+3 años**.
2. **Maintain (Mantener)** — completar formación curada más laboratorios en AWS
   Skill Builder. Extiende la credencial **+1 año**. Esta es la ruta que estoy
   usando.

El compromiso es claro: Renew te da tres años pero cuesta un examen completo;
Maintain te da un año a cambio de unas horas de aprendizaje a tu propio ritmo.
Como hace poco profundicé en temas de seguridad (acabo de aprobar la Security
Specialty), la ruta Maintain me permite mantener vigente la credencial Pro
mientras sigo aprendiendo en el mismo dominio, sin la carga del examen.

<h2 id="como-funciona">Cómo funciona la ruta Maintain</h2>

Estos son los detalles, verificados con fuentes oficiales de AWS:

- **Elegibilidad:** disponible cuando tu certificación está **dentro de los 90
  días previos a la expiración** y sigue **activa**. Las certificaciones
  expiradas **no** son elegibles — si la dejas vencer, Maintain deja de ser una
  opción.
- **Requisito previo:** una **suscripción de pago activa a AWS Skill Builder**
  (Individual mensual/anual, o Team).
- **Dónde:** en Skill Builder, ir a **Explore → Validate your skills →
  Recertify**, y seleccionar **Solutions Architect – Professional**.
- **Umbral (Professional):** sumar **700 puntos**, incluyendo **al menos dos
  actividades prácticas (laboratorios)**. (El nivel Associate requiere 500
  puntos y al menos un laboratorio.)
- **Ritmo:** a tu propio ritmo; completar todo **antes de que tu certificación
  expire**.
- **Resultado:** la certificación se **extiende un año** desde la fecha de
  finalización.
- **Extensión en cascada:** mantener SA – Professional también extiende una
  certificación de nivel inferior relacionada que siga activa (por ejemplo SA –
  Associate) para igualar la nueva fecha de expiración.
- **Estado:** esta experiencia de mantenimiento está actualmente en **Beta**
  abierta.

Los dos detalles que más importan en la práctica: debes empezar **mientras la
certificación sigue activa** (la ventana de 90 días es una ventana, no un
período de gracia), y el **total de 700 puntos es la restricción vinculante** —
el mínimo de dos laboratorios es fácil de cumplir, pero llegar a 700 requiere
planificación.

<h2 id="la-matematica">La matemática: planificar una ruta hacia 700</h2>

Los cursos de la ruta de recertificación valen entre 40 y 160 puntos; los
laboratorios SimuLearn valen 100 cada uno. En lugar de sumar puntos al azar,
orienté mi plan hacia los dominios del examen SA-Professional — arquitectura,
redes, conectividad híbrida y seguridad — para que los puntos sirvan también
como estudio real.

Esta es la ruta que planifiqué. La recertificación solo *exige* dos
laboratorios y 700 puntos, pero Skill Builder marca cuatro laboratorios
SimuLearn como la práctica de mayor valor para los dominios de SA-Professional —
redes complejas, conectividad híbrida, multi-región y seguridad de datos. Como
el objetivo es realmente mejorar, no solo cumplir el requisito, elegí hacer los
cuatro y apuntar por encima del mínimo, con una meta de **al menos 800 puntos**:

| Ítem                                                                    | Tipo   | Puntos |
| ----------------------------------------------------------------------- | ------ | ------ |
| AWS SimuLearn: Resolve VPC Routing Conflicts                            | Lab    | 100    |
| AWS SimuLearn: Inter-Region Peering                                     | Lab    | 100    |
| AWS SimuLearn: Securing Hybrid Access                                   | Lab    | 100    |
| AWS SimuLearn: Securing a Banking Data Lake                             | Lab    | 100    |
| Advanced Architecting on AWS - Online Course Supplement                 | Curso  | 160    |
| AWS Security Engineer - Edge Security                                   | Curso  | 100    |
| AWS Security Engineer - Protecting and Encrypting Data                  | Curso  | 80     |
| AWS Security Engineer - Centralized Account Management                  | Curso  | 80     |
| **Total**                                                               |        | **820** |

Son 820 puntos — bastante por encima del mínimo de 700 — superando el requisito
de dos laboratorios (cuatro laboratorios). Agregué **Centralized Account
Management** para superar los 800: la gobernanza multi-cuenta (AWS
Organizations, SCPs) es un dominio central de SA-Professional, así que se gana
su lugar por valor de aprendizaje, no solo por puntos. La ruta se inclina
deliberadamente hacia las actividades prácticas, porque ahí está el aprendizaje
real, y lo bueno de esta planificación es que los ítems son intercambiables — el
total de puntos es la restricción vinculante, así que puedes cambiar un ítem por
otro mientras el total se mantenga.

<h2 id="progreso">Seguimiento del progreso</h2>

Una vez inscrito, avanzas hacia el mínimo de puntos; Skill Builder muestra una
barra de progreso en vivo contra el umbral de 700 puntos y el requisito de dos
laboratorios:

![Página de recertificación de AWS Skill Builder para Solutions Architect – Professional, mostrando el progreso de puntos contra el umbral de 700 y el requisito de dos laboratorios prácticos](/blog/2026-09-18-aws-recert-maintain-path/skillbuilder-recertify-progress.png)

Llevo el seguimiento de cada curso en su propia carpeta de notas — una fuente de
verdad por curso — y registro lo que aprendí en las secciones de abajo a medida
que los completo.

<h2 id="curso-01">Curso 01: Protecting and Encrypting Data (completado)</h2>

El primer curso que terminé, **AWS Security Engineer: Protecting and Encrypting
Data** (80 puntos, ~1h), fue un buen repaso de la protección de datos en todo el
stack de AWS. Lo que vale la pena recordar:

- **Fundamentos de cifrado** — simétrico (misma clave para cifrar y descifrar)
  vs asimétrico (un par de claves: una cifra, la otra descifra); el hashing como
  operación *unidireccional* para integridad, no confidencialidad; y los
  certificados digitales como prueba de identidad mediante criptografía de clave
  pública.
- **Orígenes del material de clave en KMS** — la distinción entre la *clave* de
  KMS (el objeto que controlas) y el *material de clave* (los bytes que hacen la
  criptografía), y los cuatro orígenes: `AWS_KMS` (por defecto), `EXTERNAL`
  (importas el material, pero termina dentro de KMS), `AWS_CLOUDHSM` y
  `EXTERNAL_KEY_STORE` / XKS (el material nunca entra a AWS; la criptografía se
  delega hacia afuera). El par confuso es `EXTERNAL` vs `EXTERNAL_KEY_STORE`:
  importar-a-KMS vs quedarse-afuera-para-siempre.
- **Datos en reposo** — cifrado de S3 (SSE-S3 / SSE-KMS / SSE-C) y la
  optimización de costo con S3 Bucket Key; el detalle de que el cifrado y la
  clave KMS de EBS/FSx se fijan **en la creación** (re-cifrar implica copia de
  snapshot o backup→restore, nunca en el lugar); S3 Object Lock (WORM) en modos
  Governance vs Compliance; y ciclo de vida/retención en S3, EFS y FSx.
- **Datos en tránsito** — elegir entre PrivateLink, Client VPN, Verified Access
  (zero-trust, sin VPN), Site-to-Site VPN, Direct Connect (no cifrado por sí
  solo — añade VPN/MACsec) y el cifrado entre instancias de Nitro.
- **Descubrimiento y enmascaramiento** — Macie para descubrir datos sensibles en
  S3, y las políticas de protección de datos de CloudWatch Logs que enmascaran
  PII/credenciales en la ingesta (protegidas por el permiso `logs:Unmask`).

Servicios cubiertos: **KMS, ACM, cifrado de S3, Secrets Manager, Macie**. Las
notas completas y los diagramas están en la carpeta del curso en mi repo de
seguimiento de recertificación.

<h2 id="por-que">Por qué documentarlo</h2>

La mayoría del contenido sobre certificaciones de AWS trata sobre *aprobar*
exámenes. La ruta Maintain es más reciente, sigue en Beta y está poco
documentada — así que las reglas de elegibilidad y la matemática de puntos son
genuinamente difíciles de encontrar en un solo lugar. Escribirlo me mantiene
responsable con el plan y, con suerte, le ahorra a alguien más el tiempo de
juntar las reglas.

Haré un seguimiento cuando la credencial esté extendida, con notas sobre qué
cursos y laboratorios realmente valieron la pena.

### Referencias

- [AWS Certification Renewal (oficial)](https://aws.amazon.com/certification/recertification/)
- [Una nueva forma de mantener tu certificación de AWS vigente (anuncio)](https://aws.amazon.com/blogs/training-and-certification/a-new-way-to-keep-your-aws-certification-current/)
- [Recertify en AWS Skill Builder](https://skillbuilder.aws/certification/recertification)

</div>
