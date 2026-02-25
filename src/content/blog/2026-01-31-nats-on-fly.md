---
title:
  en: 'NATS server on fly.io'
  es: 'Instalación de NATS server en fly.io'
excerpt:
  en: 'Clear instructions to install and put NATS on fly.io'
  es: 'Instalación sencilla de NATS en fly.io'
date: 2026-01-31
updated: 2026-02-25
tags: ['nats-sever', 'nats', 'fly.io']
draft: true
---

<div class="lang-en">
I needed a NATS server to use as my message broker. I chose to install it on fly.io. I followed the instructions from the official documentation and found some issues, so I want to share with you how to install NATS server on fly.io without any problems.

The `dockerfile` can be used to deploy NATS:

```dockerfile
FROM nats:2.10.25-alpine

# Expose client, management, and routing ports
EXPOSE 4222 8222 6222

# Default entrypoint is already "nats-server"
CMD ["-js", "-sd", "/data", "-m", "8222"]
```

To ensure the right connection, we need to use WireGuard to establish a secure connection from local to the NATS server.

## Setup and Configuration

The first step is to configure your NATS server on fly.io and set up the necessary environment variables and secrets:

![1-setup-configuration.png](/blog/2026-01-31-nats-on-fly/1-setup-configuration.png)

## Access Methods

Once deployed, you have multiple ways to access your NATS server - through internal DNS, WireGuard VPN, or public DNS:

![2-access-methods.png](/blog/2026-01-31-nats-on-fly/2-access-methods.png)

## Testing and Monitoring

After setup, you can test the connection and monitor your NATS server using the management interface:

![3-testing-monitoring.png](/blog/2026-01-31-nats-on-fly/3-testing-monitoring.png)

</div>

<div class="lang-es hidden">
</div>
