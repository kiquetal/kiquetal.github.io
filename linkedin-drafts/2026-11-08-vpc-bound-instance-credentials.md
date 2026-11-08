# LinkedIn Comment: Why Locking EC2 Instance Credentials to the VPC Was the Right Call — and Why It Isn't an AWS Default

> 💬 **Type**: This is a COMMENT (to drop under a post about EC2 credential exfiltration / IMDS security), not a standalone post. Keep it tight.

> ⚠️ **LinkedIn formatting rule**: LinkedIn does NOT support Markdown and collapses single line breaks. Everything below the "READY TO POST" marker uses a BLANK LINE between every block. Copy it verbatim — keep the blank lines — and it will paste cleanly.

> 🔒 **Public-safe**: no account IDs, instance IDs, attacker IP, or access keys. Those stay in the private incident report.

---
## ✅ READY TO POST — English (copy verbatim, keep blank lines)

Just worked an incident that's a perfect example of this. 🔍

An EC2 instance role's temporary credentials (ASIA… STS, delivered via IMDS) were exfiltrated and replayed from an external, non-AWS IP — textbook InstanceCredentialExfiltration.OutsideAWS.

Enforcing IMDSv2 was part of the fix, but it only raises the bar on STEALING the creds (SSRF). It does nothing once an attacker has on-box RCE, or once the credentials are already off the box.

The control that actually neutralized the replay was an IAM deny keyed on aws:Ec2InstanceSourceVpc — it ties the credentials to the VPC that vended them, so any use from OUTSIDE that VPC is denied.

One nuance worth sharing: aws:SourceVpc / aws:SourceVpce don't help without VPC endpoints. aws:Ec2InstanceSourceVpc populates regardless of the network path, which made it the right key here.

So my question to AWS and the community: why is this not a default? 🤔

AWS already attaches the source VPC to the credential. Making instance-role credentials VPC-bound by default would eliminate off-box replay for most workloads with essentially zero downside. Why is this opt-in instead of opt-out?

#AWS #CloudSecurity #IAM #IMDS #IncidentResponse #DevSecOps #EC2 #CloudComputing

---
## ✅ READY TO POST — Español (copiar tal cual, mantener líneas en blanco)

Justo trabajé un incidente que es un ejemplo perfecto de esto. 🔍

Las credenciales temporales del rol de una instancia EC2 (STS tipo ASIA…, entregadas vía IMDS) fueron exfiltradas y reutilizadas desde una IP externa, fuera de AWS — el caso de manual de InstanceCredentialExfiltration.OutsideAWS.

Aplicar IMDSv2 fue parte de la solución, pero solo eleva la barrera para ROBAR las credenciales (SSRF). No hace nada una vez que el atacante logra ejecución de código en el host (RCE), ni una vez que las credenciales ya salieron de la máquina.

El control que realmente neutralizó la reutilización fue un deny de IAM basado en la clave aws:Ec2InstanceSourceVpc — ata las credenciales a la VPC que las emitió, de modo que cualquier uso desde FUERA de esa VPC queda denegado.

Un matiz que vale la pena compartir: aws:SourceVpc / aws:SourceVpce no sirven sin VPC endpoints. aws:Ec2InstanceSourceVpc se completa sin importar la ruta de red, y por eso fue la clave correcta en este caso.

Mi pregunta para AWS y la comunidad: ¿por qué esto no es el comportamiento por defecto? 🤔

AWS ya asocia la VPC de origen a la credencial. Hacer que las credenciales del rol de instancia estén ligadas a la VPC por defecto eliminaría la reutilización fuera de la máquina para la mayoría de las cargas de trabajo, prácticamente sin desventajas. ¿Por qué es opt-in en lugar de opt-out?

#AWS #CloudSecurity #IAM #IMDS #IncidentResponse #DevSecOps #EC2 #CloudComputing
