# kiquetal.dev

Personal portfolio and technical blog built with [Astro](https://astro.build).

**Live:** https://kiquetal.dev

## Project Structure

```text
/
├── public/
│   ├── blog/                    # Static assets per blog post (diagrams, images)
│   │   ├── 2026-08-12-newsletter-system-design/
│   │   ├── 2026-08-08-auth-ext-middleware/
│   │   └── ...
│   ├── images/                  # Global images
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── Card.astro
│   ├── content/
│   │   ├── blog/                # Blog posts (Markdown, bilingual en/es)
│   │   └── config.ts            # Content collection schemas
│   ├── data/
│   │   └── location.json
│   ├── layouts/
│   │   └── Layout.astro         # Base layout (SEO, OG tags, RSS discovery)
│   └── pages/
│       ├── blog/
│       │   ├── [...page].astro  # Blog listing (paginated)
│       │   ├── [slug].astro     # Individual post + newsletter subscribe form
│       │   ├── tag/[tag].astro  # Posts filtered by tag
│       │   └── date/[date].astro # Posts filtered by month
│       ├── index.astro          # Homepage
│       ├── about.astro
│       ├── contact.astro
│       ├── 404.astro
│       └── rss.xml.ts           # RSS feed
├── superdesign/                 # Vintage infographic design system
│   ├── design_iterations/       # HTML infographics
│   └── screenshot.py            # HTML → PNG export script
├── linkedin-drafts/             # LinkedIn post drafts for amplification
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Framework:** Astro (zero-JS by default)
- **Styling:** Tailwind CSS
- **Typography:** Playfair Display, JetBrains Mono
- **Icons:** astro-icon (Phosphor icons)
- **Content:** Astro Content Collections (type-safe Markdown)
- **Integrations:** @astrojs/rss, @astrojs/sitemap, @astrojs/tailwind
- **Deployment:** GitHub Pages (auto-deploy on push to `master`)
- **CDN/Proxy:** Cloudflare (Web Analytics, DDoS protection)

## Features

- Bilingual content (English / Spanish) with client-side toggle
- RSS feed with autodiscovery
- Sitemap generation
- Open Graph + Twitter Card meta tags
- Blog with pagination, tag filtering, and date archives
- Newsletter subscription (powered by Cloudflare Workers + Resend)
- Visitor counter
- Publish reminder system (15-day inactivity alerts)

## Commands

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start dev server at `localhost:4321`          |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview production build locally             |

## Deployment

Auto-deploys via `.github/workflows/deploy.yml` on push to `master`.

## Related

- **Workers:** Private repo ([kiquetal-workers](https://github.com/kiquetal/kiquetal-workers)) — Cloudflare Workers for newsletter, subscriptions, reminders
- **Design System:** See `.kiro/steering/vintage-design.md`
