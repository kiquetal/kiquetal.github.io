# How Astro Works: The "Magic" of Dynamic Routing

Astro is a static site generator that leverages **File-based Routing** and **Content Collections** to create high-performance websites. Here is a breakdown of how the "magic" happens.

## 1. The Visual Flow

```mermaid
graph TD
    A[Markdown Files /src/content/blog/*.md] --> B[Collection Schema /src/content/config.ts]
    B --> C[Dynamic Route /src/pages/blog/[slug].astro]
    C -->|getStaticPaths| D[Build Engine]
    D --> E[Final Static HTML Files /dist/blog/post-1/index.html]
```

## 2. The Process

### A. Defining the Data (Content Collections)
First, Astro needs to know what your data looks like. This is defined in `src/content/config.ts`.
- It validates your Markdown frontmatter.
- It provides TypeScript completion for your data.

### B. The Dynamic Template (`[slug].astro`)
The file name `[slug].astro` tells Astro that this page is dynamic. The `[slug]` part is a parameter that will be replaced by the actual URL.

### C. The Magic: `getStaticPaths()`
This is the most important function. It runs **only at build time**.
1. It fetches all entries from a collection.
2. It returns an array of objects.
3. Each object contains `params` (the URL part) and `props` (the data for that page).

## 3. Creating a New Dynamic Path (Example)

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
