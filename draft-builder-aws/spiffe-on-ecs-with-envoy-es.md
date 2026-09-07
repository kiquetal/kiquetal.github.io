# SPIFFE en ECS con Envoy — Zero Trust casero en Fargate

> **Borrador para AWS Builder Center.** Pega esto en el editor de community.aws.
> Donde veas `[📷 SUBIR IMAGEN AQUÍ: ...]`, borra esa línea y sube la imagen
> nombrada manualmente en esa posición dentro del editor.
>
> **Título (pégalo en el campo Title del editor):**
> SPIFFE en ECS con Envoy — Zero Trust casero en Fargate
>
> **Descripción breve / resumen (pégalo en el campo Description del editor):**
> ¿Cómo lograr mTLS zero-trust entre servicios en ECS Fargate cuando no hay un
> host EC2 contra el cual verificar la identidad? Construí Proteus — una malla
> desde cero con SPIFFE/SPIRE + Envoy — con un verificador de nodo propio que
> comprueba cada tarea vía la API de ECS y un admission controller que mantiene
> la identidad denegada-por-defecto hasta ser admitida explícitamente.
> Arquitectura, razonamiento, y un recorrido oscuro → admitir → activo.
>
> **URL canónica (configúrala en el editor):**
> https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
>
> **Tags/temas sugeridos (agrégalos en el editor):**
> `Amazon ECS`, `AWS Fargate`, `Security`, `Containers`, `Zero Trust`, `mTLS`,
> `SPIFFE`, `SPIRE`, `Envoy`, `Identity`
> (Builder Center suele esperar una mezcla de tags de servicio AWS + tags de tema —
> lidera con `Amazon ECS` / `AWS Fargate` / `Security` para descubribilidad.)

---

## Visión

Me gusta Istio, pero quería entender qué pasa realmente por debajo. Así que me propuse construir una malla zero-trust "casera" en Amazon ECS: TLS mutuo entre servicios, sin secretos de larga duración, e identidad de workload que rota automáticamente — todo sin un service mesh gestionado haciendo la magia por mí.

La pregunta difícil que dio forma a todo: **¿cómo verificas la identidad de un workload en Fargate, donde no hay un host EC2 al cual anclar la confianza?**

La respuesta son dos capas de identidad, cada una respondiendo una pregunta distinta:

- **Verificación de nodo** — *¿es realmente la tarea ECS que dice ser?*
- **Verificación de workload + admisión** — *¿puede esa tarea tener esta identidad de servicio?*

Un workload solo obtiene una identidad usable cuando ambas pasan. La identidad es denegada-por-defecto.

[📷 SUBIR IMAGEN AQUÍ: Diagrama de contenedores de Proteus — proteus-container.png (tarea de SPIRE Server + Admission Controller, y dos tareas de servicio, cada una con app, sidecar Envoy egress :9903 / ingress :9902, y SPIRE Agent)]

## Cómo lo construimos (proceso, decisiones clave, desafíos)

### Verificación de nodo — probando la tarea ECS

En Fargate no hay una instancia EC2, así que el verificador de nodo habitual `aws_iid` no aplica. Escribí un verificador de nodo propio, `proteus_ecs`, y como todo verificador de nodo de SPIRE viene en **dos mitades**: un plugin del lado del agente que reúne y envía la afirmación, y un plugin del lado del servidor que la verifica.

El lado del agente lee el endpoint de metadata de la tarea ECS y reenvía el ARN de la tarea, el cluster y la family. Lo importante está en el **lado del servidor**: nunca confía en ese payload a ciegas — llama a la API de ECS (`DescribeTasks`) para confirmar que la tarea realmente existe y obtener su rol IAM real, y luego verifica ese rol contra una allow-list. Una tarea puede *afirmar* un ARN, pero no puede falsificarlo, porque la prueba viene de AWS, no de la afirmación del propio agente.

[📷 SUBIR IMAGEN AQUÍ: Secuencia de verificación de nodo — proteus-node-attestation.png (SPIRE Agent afirma el ARN de la tarea → SPIRE Server verifica vía ECS DescribeTasks + allow-list IAM → SVID de nodo o PermissionDenied)]

### Verificación de workload + admisión — probando el servicio

La verificación de nodo dice *qué tarea*; el admission controller dice *qué identidad de servicio puede tener esa tarea*. En `POST /admit`, crea una entrada de registro en SPIRE vía la Entry API.

La costura que une las dos capas es el **`parentID`** de la entrada: se configura exactamente al SVID de nodo que emitió `proteus_ecs`. Así, cuando Envoy más tarde le pide a su agente local un SVID de workload vía SDS, el SPIRE Server verifica dos cosas — la identidad de nodo del agente solicitante contra el `parentID` de la entrada, y los selectores del workload — antes de emitir el certificado. El controller solo puede otorgar una identidad a un nodo que el plugin ya avaló.

[📷 SUBIR IMAGEN AQUÍ: Secuencia de admisión — proteus-admission.png (admission controller CreateEntry → SPIRE Server → petición SDS del agente coincide → se emite SVID de workload)]

Así, el plugin establece la *confianza de infraestructura* (una tarea ECS genuina con un rol aprobado); el admission controller añade *política de aplicación* encima (esta tarea puede ser `service-a`). Ninguno basta por sí solo.

### Probándolo — oscuro → admitir → activo

Dos servicios ECS, `service-a` (invocador) y `service-b` (receptor), cada uno con un sidecar Envoy y un SPIRE Agent co-ubicado. Antes de la admisión, la petición SDS de Envoy es denegada y la llamada falla con `503 UF`. En el momento en que el admission controller crea la entrada en SPIRE, el SVID se empuja y la llamada mTLS tiene éxito.

[📷 SUBIR IMAGEN AQUÍ: Comparación oscuro vs activo — dark_vs_live.png]

La recompensa está en el lado receptor: el Envoy de `service-b` registra `peer=spiffe://proteus.local/service-a`. No solo aceptó una conexión TLS — verificó criptográficamente *quién* estaba llamando. Sin secreto compartido, sin certificado estático.

[📷 SUBIR IMAGEN AQUÍ: mTLS activo exitoso — envoy-svc-b-obtaining-cert-from-b.png (mTLS entrante con SPIFFE ID del par verificado)]

## Desafíos que enfrentamos

- **Sin host EC2 en Fargate** — el verificador de nodo estándar `aws_iid` queda fuera, forzando un verificador `proteus_ecs` propio construido alrededor del endpoint de metadata de la tarea ECS + `DescribeTasks`.
- **Confiar en la afirmación vs. verificarla** — el agente solo puede *afirmar* un ARN de tarea. Toda la verificación real tuvo que vivir del lado del servidor, fuera de banda vía la API de ECS, contrastada contra una allow-list de roles IAM.
- **Vincular una entrada al agente correcto** — lograr bien la relación `parentID` = SVID-de-nodo para que un SVID de workload solo pueda servirse a la tarea específica para la que fue admitido.
- **Secuenciar el denegar-por-defecto** — la verificación de nodo debe ocurrir primero (al arrancar el agente); sin un SVID de nodo no hay `parentID` al cual apuntar una entrada de workload.

## Lecciones aprendidas

- En Fargate, la identidad de workload significa repensar la verificación de nodo desde cero — no hay host en el cual apoyarse, así que las APIs de AWS (`DescribeTasks`) se vuelven el ancla de confianza.
- Separa las dos preguntas con claridad: *qué tarea* (verificación de nodo) vs. *qué identidad de servicio* (admisión). Confundirlas hace el diseño imposible de razonar.
- El límite de confianza pasa de *dónde* está un servicio (IP / security group) a *quién* es (un SPIFFE ID verificado). Ese cambio mental es el punto central de una malla zero-trust.
- El salto de puertos me tomó tiempo internalizarlo: la app hace una llamada en texto plano a `localhost:9903` y Envoy la eleva transparentemente a mTLS hacia el `:9902` del par — la app nunca toca certificados.

## Recursos

- Análisis completo (arquitectura, diagramas, y el recorrido oscuro → admitir → activo):
  https://kiquetal.dev/blog/2026-08-31-spiffe-on-ecs-with-envoy
- SPIFFE / SPIRE: https://spiffe.io
- Envoy SDS: https://www.envoyproxy.io/docs/envoy/latest/configuration/security/secret

---

### Checklist de subida de imágenes (para el editor)

1. `proteus-container.png` — después de la sección Visión
2. `proteus-node-attestation.png` — después del texto de "Verificación de nodo"
3. `proteus-admission.png` — después del texto de "Verificación de workload + admisión"
4. `dark_vs_live.png` — en la sección "Probándolo"
5. `envoy-svc-b-obtaining-cert-from-b.png` — después del párrafo de "recompensa"

Las imágenes fuente viven en:
`public/blog/2026-08-31-spiffe-on-ecs-with-envoy/`
