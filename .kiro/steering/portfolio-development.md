# Portfolio Development - Steering Guide

## Purpose
Development standards and guidelines for the kiquetal.dev Astro portfolio project.

## Tech Stack
- **Framework:** Astro 
- **Site URL:** https://kiquetal.dev
- **Deployment:** GitHub Pages (auto-deploy on `main` branch push)
- **Icons:** astro-icon integration

## Project Structure
```
src/
├── components/    # Reusable Astro components
├── content/       # Content collections (blog posts, projects, etc.)
├── layouts/       # Page layouts
└── pages/         # Routes and pages
```

## Development Standards

### Component Guidelines
- Use `.astro` files for components with minimal JavaScript
- Keep components focused and single-purpose
- Extract reusable logic into separate components
- Use TypeScript for type safety in frontmatter

### Content Management
- Store blog posts and projects in `src/content/`
- Use Astro Content Collections for type-safe content
- Define schemas in `src/content/config.ts`

### Superdesign Images
- Place superdesign-generated images in `public/blog/<slug-of-the-blog>/<image>`
- Reference in blog posts at `src/content/blog/<slug-of-the-blog>/` as `/blog/<slug-of-the-blog>/<image>`
- This structure keeps images co-located with their blog content

### Styling
- Follow vintage design system (see `vintage-design.md`)
- Use scoped styles in `.astro` components
- Maintain consistent spacing and typography

### Performance
- Leverage Astro's zero-JS by default
- Use `client:*` directives only when interactivity is needed
- Optimize images with Astro's image optimization

## Commands
```bash
npm run dev      # Local development at localhost:4321
npm run build    # Production build to ./dist/
npm run preview  # Preview production build
```

## Deployment
- Auto-deploys via `.github/workflows/deploy.yml`
- Triggered on push to `main` branch
- Deploys to GitHub Pages

## Best Practices
- Test locally before pushing to `main`
- Keep dependencies minimal
- Follow accessibility standards (WCAG 2.1 AA)
- Optimize for SEO (meta tags, semantic HTML)
- Use semantic HTML5 elements
