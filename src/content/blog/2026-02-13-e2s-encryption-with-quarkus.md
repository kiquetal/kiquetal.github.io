---
title:
  en: 'End to End encryption with quarkus'
  es: 'Encriptación de extremo a extremo con Quarkus'
excerpt:
  en: 'An implementation of e2e encryption.'
  es: 'Una implementatación de encriptación e2e.'
date: 2026-02-13
tags: ['quarkus', 'encryption','angular']
draft: true
---

<div class="lang-en">

<div class="demo-box">
  <div class="demo-label">🔐 Live Demo</div>
  <a href="https://e2equarks.kiquetal.dev/whisper" target="_blank" class="demo-url">https://e2equarks.kiquetal.dev/whisper</a>
</div>

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

![AES-GCM File Encryption Part 1](/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part1-en.png)

![AES-GCM File Encryption Part 2](/blog/2026-02-13-e2s-encryption-with-quarkus/aes-gcm-file-encryption-part2-en.png)

</div>

<div class="lang-es hidden">

<div class="demo-box">
  <div class="demo-label">🔐 Demo en Vivo</div>
  <a href="https://e2equarks.kiquetal.dev/whisper" target="_blank" class="demo-url">https://e2equarks.kiquetal.dev/whisper</a>
</div>





## Arquitectura

### Vista General del Sistema

```ascii
┌──────────────────────────────────────────────────────────────────┐
│                      Navegador del Usuario                       │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ 1. Acceder a la UI Web
                               │    http://localhost:8080/whisper
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

</div>
