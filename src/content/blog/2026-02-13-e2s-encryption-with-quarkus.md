---
title:
  en: 'End to End encryption with quarkus'
  es: 'Encriptación de extremo a extremo con Quarkus'
excerpt:
  en: 'An implementation of e2e encryption.'
  es: 'Una implementación de encriptación e2e.'
date: 2026-02-13
tags: ['quarkus', 'encryption','angular','aes-gcm']
draft: true
---

<div class="lang-en">

<div class="demo-box demo-box-small">
  <div class="demo-label">🔐 Live Demo</div>
  <a href="https://e2equarks.kiquetal.dev/whisper" target="_blank" class="demo-url">https://e2equarks.kiquetal.dev/whisper</a>
</div>

## Description of the problem

I wanted to implement encryption both in transit and at rest. For this particular scenario, I have implemented an Angular project that uses AES-256-GCM. The user enters a pre-defined passphrase that the server should share securely; using this passphrase, we start the process of encrypting a file. Following the AES-256 standard, we'll end up with an encrypted file including an authentication tag.

We will use the same configuration from the client to decrypt on the server to ensure the file was correctly encrypted. Later, we will encrypt the file using a master key from the server. We'll use envelope encryption to encrypt the randomly generated Data Encryption Key (DEK) used for the file and IV, and then encrypt this DEK with a Master Key (KEK). Using this pattern, we rely on the server to perform decryption operations.




## Architecture

### System Overview

```ascii
┌──────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ 1. Access Web UI
                               │    https://e2equarks.kiquetal.dev/whisper
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Angular Frontend (SPA)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │   Passphrase   │  │   Auth Guard   │  │   MP3 Upload      │  │
│  │   Component    │  │   & Service    │  │   Component       │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
│         │                                          │              │
│         │ 2. Validate Passphrase                  │              │
│         │    (AES-GCM client-side encryption)     │              │
│         └──────────────────┬───────────────────────┘              │
│                            │ 3. Upload Encrypted File             │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             │ Quinoa Integration
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Quarkus Backend                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              FileUploadResource                            │  │
│  │  • POST /api/validate-passphrase                          │  │
│  │  • POST /api/upload (100MB limit)                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              CryptoService (service/)                      │  │
│  │  • Verify & decrypt from Angular                          │  │
│  │  • Encrypt with random DEK (streaming)                    │  │
│  │  • Create envelope (encrypt DEK with master key)          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           S3StorageService (util/)                         │  │
│  │  • Generate S3 keys                                        │  │
│  │  • Upload encrypted file                                   │  │
│  │  • Upload envelope metadata                                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            │ 4. Store Encrypted Data              │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             │ S3 Client
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    S3/Tigris Object Storage                      │
│  • uploads/{email}/{uuid}/file.enc    (encrypted data)          │
│  • uploads/{email}/{uuid}/metadata.json (encrypted DEK)         │
│                                                                  │
│  Dev:  LocalStack (Docker container)                            │
│  Prod: Tigris or AWS S3                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Encryption Flow

```
User Browser
    ↓ (Client encrypts with passphrase: AES-256-GCM + PBKDF2)
Encrypted File → Quarkus Backend
    ↓ (Verify passphrase & decrypt: streaming)
Plaintext Data → CryptoService
    ↓ (Encrypt with random DEK: streaming)
DEK-Encrypted Data
    ↓ (Encrypt DEK with master key: envelope)
S3/Tigris Storage
    ├─ Encrypted File Data
    └─ Metadata (with encrypted DEK)
```

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/architeture-angular-quarkus-en.png" alt="Architecture Overview" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-256-en.png" alt="AES-GCM Encryption" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part1-en.png" alt="AES-GCM File Encryption Part 1" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part2-en.png" alt="AES-GCM File Encryption Part 2" class="img-small" />

</div>

<div class="lang-es hidden">

<div class="demo-box demo-box-small">
  <div class="demo-label">🔐 Demo en Vivo</div>
  <a href="https://e2equarks.kiquetal.dev/whisper" target="_blank" class="demo-url">https://e2equarks.kiquetal.dev/whisper</a>
</div>

## Descripción del problema

Quería implementar encriptación tanto en tránsito como en reposo. Para este escenario particular, he implementado un proyecto en Angular que utiliza AES-256-GCM. El usuario ingresa una frase de contraseña predefinida que el servidor debe compartir de manera segura; utilizando esta frase, iniciamos el proceso de encriptación de un archivo. Siguiendo el estándar AES-256, terminaremos con un archivo encriptado que incluye una etiqueta de autenticación.

Utilizaremos la misma configuración del cliente para desencriptar en el servidor y asegurar que el archivo fue encriptado correctamente. Posteriormente, encriptaremos el archivo utilizando una clave maestra del servidor. Utilizaremos encriptación de sobre (envelope encryption) para encriptar la Clave de Encriptación de Datos (DEK) generada aleatoriamente que se usó para el archivo y el IV, y luego encriptaremos esta DEK con una Clave Maestra (KEK). Usando este patrón, confiaremos en el servidor para realizar las operaciones de desencriptación.

## Arquitectura

### Vista General del Sistema

```ascii
┌──────────────────────────────────────────────────────────────────┐
│                      Navegador del Usuario                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ 1. Acceder a la UI Web
                               │    https://e2equarks.kiquetal.dev/whisper
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Angular Frontend (SPA)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────┐  │
│  │   Passphrase   │  │   Auth Guard   │  │   Subir MP3       │  │
│  │   Component    │  │   & Service    │  │   Component       │  │
│  └────────────────┘  └────────────────┘  └───────────────────┘  │
│         │                                          │              │
│         │ 2. Validar Passphrase                   │              │
│         │    (Encriptación AES-GCM en cliente)    │              │
│         └──────────────────┬───────────────────────┘              │
│                            │ 3. Subir Archivo Encriptado          │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             │ Integración Quinoa
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Quarkus Backend                             │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              FileUploadResource                            │  │
│  │  • POST /api/validate-passphrase                          │  │
│  │  • POST /api/upload (límite 100MB)                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              CryptoService (service/)                      │  │
│  │  • Verificar y desencriptar desde Angular                 │  │
│  │  • Encriptar con DEK aleatorio (streaming)                │  │
│  │  • Crear envelope (encriptar DEK con clave maestra)       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           S3StorageService (util/)                         │  │
│  │  • Generar claves S3                                       │  │
│  │  • Subir archivo encriptado                                │  │
│  │  • Subir metadata del envelope                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│                            │ 4. Almacenar Datos Encriptados       │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             │ Cliente S3
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Almacenamiento S3/Tigris                        │
│  • uploads/{email}/{uuid}/file.enc    (datos encriptados)       │
│  • uploads/{email}/{uuid}/metadata.json (DEK encriptado)        │
│                                                                  │
│  Dev:  LocalStack (contenedor Docker)                           │
│  Prod: Tigris o AWS S3                                          │
└──────────────────────────────────────────────────────────────────┘
```

### Flujo de Encriptación

```
Navegador Usuario
    ↓ (Cliente encripta con passphrase: AES-256-GCM + PBKDF2)
Archivo Encriptado → Backend Quarkus
    ↓ (Verificar passphrase y desencriptar: streaming)
Datos en Texto Plano → CryptoService
    ↓ (Encriptar con DEK aleatorio: streaming)
Datos Encriptados con DEK
    ↓ (Encriptar DEK con clave maestra: envelope)
Almacenamiento S3/Tigris
    ├─ Datos del Archivo Encriptado
    └─ Metadata (con DEK encriptado)
```

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/architeture-angular-quarkus-es.png" alt="Vista General de la Arquitectura" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-256-es.png" alt="Encriptación AES-GCM" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part1-es.png" alt="Encriptación de Archivos AES-GCM Parte 1" class="img-small" />

<img src="/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part2-es.png" alt="Encriptación de Archivos AES-GCM Parte 2" class="img-small" />

</div>
