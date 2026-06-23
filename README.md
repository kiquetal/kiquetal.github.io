# My Portfolio

This is a portfolio project built with [Astro](https://astro.build).

## Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |

## Deployment

This project is configured to deploy automatically to GitHub Pages using GitHub Actions.
The workflow file is located at `.github/workflows/deploy.yml`.

Pushing to the `main` branch will trigger the deployment.

## Recent Updates

### 2026-06-22
- Added Open Graph and Twitter Card meta tags for rich link previews
  - Per-page descriptions for index, about, contact
  - Blog posts use their excerpt as OG description
  - Canonical URLs and twitter:card support

### 2026-02-24
- Added NATS on Fly.io deployment process diagrams
  - Setup & Configuration diagram
  - Access Methods diagram (internal DNS, WireGuard, public DNS)
  - Testing & Monitoring diagram
  - Located in `public/blog/2026-01-31-nats-on-fly/`
