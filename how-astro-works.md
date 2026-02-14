# How Astro Works: The "Magic" of Dynamic Routing

Astro is a static site generator that leverages **File-based Routing** and **Content Collections** to create high-performance websites. Here is a breakdown of how the project is structured and how the "magic" happens.

## 1. The Visual Flow

```mermaid
graph TD
    subgraph Source [src Folder]
        A[content/ - Markdown & Data] --> B[config.ts - Schema]
        C[components/ - UI Reusable Units] --> E[pages/ - Routes & Assembly]
        D[layouts/ - Page Shells] --> E
        B --> E
    end
    E -->|Build Engine| F[dist/ - Static Site]
    
    subgraph Dynamic_Routing [Dynamic Blog Flow]
        B --> G[pages/blog/[slug].astro]
        G -->|getStaticPaths| F
    end
```

## 2. Folder Structure & Responsibilities

The `src/` directory is where most of the development happens. Each folder has a specific role:

### `src/components/`
Contains reusable UI components. These are `.astro` files (or React/Vue/etc.) that represent pieces of the interface, like cards, buttons, or navigation bars. They are imported and used within pages or layouts to maintain consistency.

### `src/content/`
This is the "database" of the project. It uses **Astro Content Collections** to manage Markdown files.
- `blog/`: Contains the actual posts as `.md` files.
- `config.ts`: Defines the schema (using Zod) to validate the frontmatter of your Markdown files, ensuring type safety across the site.

### `src/layouts/`
Layouts are special Astro components that provide a common page shell. They typically contain the `<html>`, `<head>`, and `<body>` tags, along with global styles and navigation. Other pages wrap their content in a Layout to inherit the structure.

### `src/pages/`
Astro uses **File-based Routing**. Any file in this directory automatically becomes a URL on your website.
- `index.astro` → `/`
- `contact.astro` → `/contact`
- `blog/` → Contains the blog listing and individual post templates.

## 3. The Dynamic Process

### A. Defining the Data (Content Collections)
First, Astro needs to know what your data looks like. This is defined in `src/content/config.ts`.
- It validates your Markdown frontmatter.
- It provides TypeScript completion for your data.

### B. The Dynamic Template (`[slug].astro`)
The file name `[slug].astro` tells Astro that this page is dynamic. The `[slug]` part is a parameter that will be replaced by the actual URL.

### C. The Magic: `getStaticPaths()`
This is the most important function for dynamic routes. It runs **only at build time**.
1. It fetches all entries from a collection.
2. It returns an array of objects.
3. Each object contains `params` (the URL part) and `props` (the data for that page).

## 4. Creating a New Dynamic Path (Example)

Suppose you want to add a "Projects" section at `/projects/[id]`.

### Step 1: Update `src/content/config.ts`
```typescript
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = {
  'blog': blogCollection,
  'projects': projects, // Add this
};
```

### Step 2: Create a Project File
Create `src/content/projects/my-app.md`:
```markdown
---
title: My Cool App
description: A revolutionary tool.
---
# Content of the project...
```

### Step 3: Create the Dynamic Page
Create `src/pages/projects/[id].astro`:
```astro
---
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  return projects.map(project => ({
    params: { id: project.slug }, // This maps to the [id] in the filename
    props: { project },
  }));
}

const { project } = Astro.props;
const { Content } = await project.render();
---
<html>
  <body>
    <h1>{project.data.title}</h1>
    <Content />
  </body>
</html>
```

## 4. Bilingual Content (Specific to this Project)

This repository uses a custom pattern to handle English (EN) and Spanish (ES) content in the same Markdown file.

### How it's structured:
In your `.md` file, you use HTML `div` tags with specific classes:
```markdown
<div class="lang-en">
  ## Header in English
  Content here...
</div>

<div class="lang-es hidden">
  ## Cabecera en Español
  Contenido aquí...
</div>
```

### How the switching works:
In `src/pages/blog/[slug].astro`, there is a client-side script that:
1. Detects the preferred language from `localStorage`.
2. Toggles the `hidden` class on all elements with `.lang-en` or `.lang-es`.
3. Synchronizes the language state between the static layout and the rendered Markdown content.

## 5. Why this is "Magic"
- **Zero Client-side JS**: By default, Astro renders everything to HTML. The `getStaticPaths` logic never reaches the user's browser.
- **Instant Loading**: Since every possible path is pre-calculated and turned into an `index.html` file, your site is incredibly fast.
- **Type Safety**: If you forget a required field in your Markdown, the build will fail, preventing broken pages.
