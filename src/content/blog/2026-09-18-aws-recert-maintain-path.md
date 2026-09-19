---
title:
  en: 'Keeping AWS Solutions Architect Pro current without the exam: the Skill Builder Maintain path'
  es: 'Manteniendo mi AWS Solutions Architect Pro sin reexamen: la ruta Maintain de Skill Builder'
excerpt:
  en: 'AWS certifications expire every three years. Instead of retaking the SA-Professional exam, I am using the Skill Builder "Maintain" path — earning 700 points and two hands-on labs to extend the credential by one year. Here is how the path works, the eligibility gotchas, and the curated route I planned to reach 700.'
  es: 'Las certificaciones de AWS caducan cada tres años. En lugar de volver a rendir el examen SA-Professional, estoy usando la ruta "Maintain" de Skill Builder — sumando 700 puntos y dos laboratorios prácticos para extender la credencial un año. Aquí explico cómo funciona la ruta, los detalles de elegibilidad y la ruta que planifiqué para llegar a 700.'
date: 2026-09-18
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

## Two ways to keep a certification current

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

## How the Maintain path works

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

## The math: planning a route to 700

Courses on the recert path are worth anywhere from 40 to 160 points; the
SimuLearn labs are worth 100 each. Rather than grab points at random, I weighted
my plan toward SA-Professional exam domains — architecture, networking, hybrid
connectivity, and security — so the points do double duty as real study.

Here is the route I planned:

| Item                                                                   | Type   | Points |
| ---------------------------------------------------------------------- | ------ | ------ |
| AWS SimuLearn: Resolve VPC Routing Conflicts                           | Lab    | 100    |
| AWS SimuLearn: Inter-Region Peering                                    | Lab    | 100    |
| Advanced Architecting on AWS - Online Course Supplement                | Course | 160    |
| AWS Security Engineer - Network Security and Secure Hybrid Connectivity | Course | 100    |
| AWS Security Engineer - Edge Security                                  | Course | 100    |
| AWS Security Engineer - Protecting and Encrypting Data                 | Course | 80     |
| Well-Architected For Enterprises                                       | Course | 80     |
| **Total**                                                              |        | **720** |

That is 720 points — a small buffer over 700 — with the two-lab minimum
satisfied by the two SimuLearn activities, in roughly nine hours of content.
The nice property of this planning is that items are swappable: the 700-point
total is what gates the recertification, so you can trade one course for another
as long as the total holds.

## Where I am right now

I am just getting started, working through the courses I flagged as **Start**
(highest Pro-level learning value). So far:

- **Protecting and Encrypting Data** — done (80 points).
- **Edge Security** — in progress.

That puts me at 80 of 700 confirmed, with a clear path to the rest. I am
tracking each course in its own notes folder — one source of truth per course,
mirrored into a summary tracker — so the point total and days-remaining stay
honest as I go.

## Why write this down

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

## Dos formas de mantener vigente una certificación

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

## Cómo funciona la ruta Maintain

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

## La matemática: planificar una ruta hacia 700

Los cursos de la ruta de recertificación valen entre 40 y 160 puntos; los
laboratorios SimuLearn valen 100 cada uno. En lugar de sumar puntos al azar,
orienté mi plan hacia los dominios del examen SA-Professional — arquitectura,
redes, conectividad híbrida y seguridad — para que los puntos sirvan también
como estudio real.

Esta es la ruta que planifiqué:

| Ítem                                                                    | Tipo   | Puntos |
| ----------------------------------------------------------------------- | ------ | ------ |
| AWS SimuLearn: Resolve VPC Routing Conflicts                            | Lab    | 100    |
| AWS SimuLearn: Inter-Region Peering                                     | Lab    | 100    |
| Advanced Architecting on AWS - Online Course Supplement                 | Curso  | 160    |
| AWS Security Engineer - Network Security and Secure Hybrid Connectivity | Curso  | 100    |
| AWS Security Engineer - Edge Security                                   | Curso  | 100    |
| AWS Security Engineer - Protecting and Encrypting Data                  | Curso  | 80     |
| Well-Architected For Enterprises                                        | Curso  | 80     |
| **Total**                                                               |        | **720** |

Son 720 puntos — un pequeño margen sobre 700 — con el mínimo de dos laboratorios
cubierto por las dos actividades SimuLearn, en aproximadamente nueve horas de
contenido. Lo bueno de esta planificación es que los ítems son
intercambiables: el total de 700 puntos es lo que habilita la recertificación,
así que puedes cambiar un curso por otro mientras el total se mantenga.

## Dónde estoy ahora mismo

Recién estoy empezando, avanzando por los cursos que marqué como **Start**
(mayor valor de aprendizaje a nivel Pro). Hasta ahora:

- **Protecting and Encrypting Data** — completado (80 puntos).
- **Edge Security** — en progreso.

Eso me deja en 80 de 700 confirmados, con una ruta clara para el resto. Llevo
el seguimiento de cada curso en su propia carpeta de notas — una fuente de
verdad por curso, reflejada en un tracker resumen — para que el total de puntos
y los días restantes se mantengan honestos a medida que avanzo.

## Por qué documentarlo

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
