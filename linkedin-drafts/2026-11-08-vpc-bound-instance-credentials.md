# LinkedIn Post: Why Locking EC2 Instance Credentials to the VPC Was the Right Call — and Why It Isn't an AWS Default

> 📷 **Image Recommendation**: A simple diagram — compromised EC2 → IMDS creds stolen → replayed from external IP (❌ denied by VPC lock). Or a screenshot of the IAM deny policy with aws:Ec2InstanceSourceVpc highlighted.

> ⚠️ **LinkedIn formatting rule**: LinkedIn does NOT support Markdown and collapses single line breaks. Everything below the "READY TO POST" marker uses a BLANK LINE between every block and `▸` as manual bullets. Copy it verbatim — keep the blank lines — and it will paste cleanly. Do not re-wrap or remove the empty lines.

> 🔒 **Public-safe**: no account IDs, instance IDs, attacker IP, or access keys. Those stay in the private incident report.

---
## ✅ READY TO POST — English (copy verbatim, keep blank lines)

An attacker stole an EC2 instance's AWS credentials and used them from their own laptop. One IAM condition key shut that down completely. 🔒

Here's the incident, and a question I can't stop asking AWS.

What happened:

▸ A compromised EC2 instance leaked its temporary IAM role credentials (the ASIA… STS keys that AWS vends through the Instance Metadata Service / IMDS).

▸ The attacker replayed those credentials from an external, non-AWS IP — the textbook InstanceCredentialExfiltration.OutsideAWS pattern.

The usual advice is "enforce IMDSv2." We did — but here's the uncomfortable truth:

IMDSv2 only raises the bar on STEALING the credentials (it blocks simple SSRF). It does nothing once an attacker has code execution on the box, and nothing once the credentials are already off the box. The replay still works.

What actually neutralized the replay was an IAM deny built on one condition key:

aws:Ec2InstanceSourceVpc

It ties the instance-role credentials to the VPC that issued them. Use them from anywhere outside that VPC — like an attacker's machine — and every call is denied. The stolen keys became worthless the moment they left the network.

One nuance for anyone implementing this:

▸ aws:SourceVpc and aws:SourceVpce only populate for VPC-endpoint traffic. If you don't run endpoints, they won't help.

▸ aws:Ec2InstanceSourceVpc is bound to the instance credentials themselves and populates no matter the network path. That's why it was the right key here.

Now the question. 🤔

AWS ALREADY knows which VPC issued the credential — it's right there in the request context. So why are instance-role credentials not VPC-bound by DEFAULT?

Making this the default would eliminate off-box credential replay for the vast majority of workloads, with essentially zero downside. Instead it's an opt-in condition key most teams have never heard of.

Why is this opt-in instead of opt-out, AWS? 👀

#AWS #CloudSecurity #IAM #IMDS #IncidentResponse #DevSecOps #EC2 #CloudComputing #InfoSec

---
## ✅ READY TO POST — Español (copiar tal cual, mantener líneas en blanco)

Un atacante robó las credenciales AWS de una instancia EC2 y las usó desde su propia laptop. Una sola clave de condición de IAM cortó eso por completo. 🔒

Acá va el incidente, y una pregunta que no dejo de hacerle a AWS.

Qué pasó:

▸ Una instancia EC2 comprometida filtró las credenciales temporales de su rol de IAM (las claves STS tipo ASIA… que AWS entrega a través del Instance Metadata Service / IMDS).

▸ El atacante reutilizó esas credenciales desde una IP externa, fuera de AWS — el patrón de manual InstanceCredentialExfiltration.OutsideAWS.

El consejo habitual es "aplicá IMDSv2". Lo hicimos — pero esta es la verdad incómoda:

IMDSv2 solo eleva la barrera para ROBAR las credenciales (bloquea el SSRF simple). No hace nada una vez que el atacante tiene ejecución de código en la máquina, ni una vez que las credenciales ya salieron del host. La reutilización sigue funcionando.

Lo que realmente neutralizó la reutilización fue un deny de IAM construido sobre una sola clave de condición:

aws:Ec2InstanceSourceVpc

Ata las credenciales del rol de la instancia a la VPC que las emitió. Usalas desde cualquier lugar fuera de esa VPC — como la máquina de un atacante — y toda llamada queda denegada. Las claves robadas quedaron inútiles en el momento en que salieron de la red.

Un matiz para quien lo vaya a implementar:

▸ aws:SourceVpc y aws:SourceVpce solo se completan para tráfico que pasa por VPC endpoints. Si no usás endpoints, no te sirven.

▸ aws:Ec2InstanceSourceVpc está ligada a las credenciales de la instancia y se completa sin importar la ruta de red. Por eso fue la clave correcta acá.

Ahora la pregunta. 🤔

AWS YA sabe qué VPC emitió la credencial — está ahí mismo en el contexto de la solicitud. Entonces, ¿por qué las credenciales del rol de instancia no están ligadas a la VPC por DEFECTO?

Hacerlo el comportamiento por defecto eliminaría la reutilización de credenciales fuera de la máquina para la gran mayoría de las cargas de trabajo, prácticamente sin desventajas. En cambio, es una clave de condición opt-in de la que la mayoría de los equipos nunca escuchó.

¿Por qué es opt-in en lugar de opt-out, AWS? 👀

#AWS #CloudSecurity #IAM #IMDS #IncidentResponse #DevSecOps #EC2 #CloudComputing #InfoSec
