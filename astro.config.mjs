import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://kiquetal.dev',
  integrations: [icon(), tailwind(), sitemap()],
  vite: {
    server: {
      watch: {
        usePolling: true,
        ignored: (path) => {
          // Ignore heavy system/dependency/build directories
          if (
            path.includes('node_modules') ||
            path.includes('.git') ||
            path.includes('.astro') ||
            path.includes('.github') ||
            path.includes('.idea') ||
            path.includes('.kiro') ||
            path.includes('.agents') ||
            path.includes('dist') ||
            path.includes('tmp') ||
            path.includes('superdesign')
          ) {
            return true;
          }
          
          // Ignore root level non-source files to avoid consuming extra file descriptors
          const rootFilesToIgnore = [
            'README.md',
            'how-astro-works.md',
            'resend-field.md',
            'SKILL.md',
            'GEMINI.md',
            'screenshot.py',
            'cloudflare-worker.js',
            'worker-counter.js',
            'wrangler.toml',
            'wrangler_for_counter.toml',
            '.gitignore',
            'CNAME',
            '_config.yml',
            'index.html',
            'package-lock.json',
            'tsconfig.json'
          ];
          if (rootFilesToIgnore.some(file => path.endsWith('/' + file) || path === file)) {
            return true;
          }
          
          return false;
        }
      }
    }
  }
});