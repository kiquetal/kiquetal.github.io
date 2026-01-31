import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.object({
      en: z.string(),
      es: z.string(),
    }),
    excerpt: z.object({
      en: z.string(),
      es: z.string(),
    }),
    date: z.date(),
    liveUrl: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = {
  'blog': blogCollection,
};
