---
title:
  en: 'Integrating Resend for Transactional Emails'
  es: 'Integrando Resend para Correos Transaccionales'
excerpt:
  en: 'A step-by-step guide to sending emails using the Resend API in a Node.js application.'
  es: 'Una guía paso a paso para enviar correos usando la API de Resend en una aplicación Node.js.'
date: 2024-03-25
liveUrl: 'https://resend.com/docs/introduction'
---

<div class="lang-en">

## Introduction

Resend is a modern email API for developers. It provides a clean and easy-to-use interface for sending transactional emails. In this guide, we'll walk through setting up Resend in a Node.js project.

### Prerequisites

*   A Resend account
*   Node.js installed
*   An API Key from the Resend dashboard

### Step 1: Installation

First, install the Resend SDK:

```bash
npm install resend
```

### Step 2: Sending an Email

Create a file named `send-email.js` and add the following code:

```javascript
import { Resend } from 'resend';

const resend = new Resend('re_123456789');

(async function() {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'Hello World',
    html: '<strong>It works!</strong>',
  });

  if (error) {
    return console.error({ error });
  }

  console.log({ data });
})();
```

### Conclusion

Resend simplifies the process of sending emails with a developer-first approach.

</div>

<div class="lang-es hidden">

## Introducción

Resend es una API de correo electrónico moderna para desarrolladores. Proporciona una interfaz limpia y fácil de usar para enviar correos transaccionales. En esta guía, recorreremos la configuración de Resend en un proyecto de Node.js.

### Prerrequisitos

*   Una cuenta de Resend
*   Node.js instalado
*   Una clave API del panel de control de Resend

### Paso 1: Instalación

Primero, instala el SDK de Resend:

```bash
npm install resend
```

### Paso 2: Enviando un Correo

Crea un archivo llamado `send-email.js` y agrega el siguiente código:

```javascript
import { Resend } from 'resend';

const resend = new Resend('re_123456789');

(async function() {
  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'Hola Mundo',
    html: '<strong>¡Funciona!</strong>',
  });

  if (error) {
    return console.error({ error });
  }

  console.log({ data });
})();
```

### Conclusión

Resend simplifica el proceso de envío de correos con un enfoque centrado en el desarrollador.

</div>
