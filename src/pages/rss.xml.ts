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
      title: post.data.title.en,
      description: post.data.excerpt.en,
      pubDate: post.data.date,
      link: `/blog/${post.slug}/`,
    })),
  });
}
