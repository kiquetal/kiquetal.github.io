import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  const sorted = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'kiquetal — Systems Architecture Blog',
    description: 'Resilience Engineering, Distributed Systems, Cloud Native',
    site: context.site,
	items: sorted.map(post => ({
      title: `${post.data.title.en} | ${post.data.title.es}`,
      description: `
        <div class="lang-en-content">
          <p>${post.data.excerpt?.en || post.data.description?.en || "System architectural documentation."}</p>
        </div>
        <div class="lang-es-content" style="display:none;">
          <p>${post.data.excerpt?.es || post.data.description?.es || "Documentación arquitectónica del sistema."}</p>
        </div>
      `,
      pubDate: post.data.date,
      link: `/blog/${post.slug}/`,
    })),
  });
}
