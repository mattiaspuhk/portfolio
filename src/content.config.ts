import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const metric = z.object({
  label: z.string(), // e.g. "Time to first words"
  before: z.string().optional(), // e.g. "27.3s"
  after: z.string(), // e.g. "12.9s"
  note: z.string().optional(),
});

const work = defineCollection({
  loader: glob({ base: './src/content/work', pattern: '**/[^_]*.mdx' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        summary: z.string().max(200), // card one-liner
        tldr: z.string().optional(), // the 30-second version
        order: z.number().int(),
        org: z.string(), // e.g. "RingIT · GAIA"
        role: z.string(),
        period: z.object({ start: z.coerce.date(), end: z.coerce.date().optional() }),
        stack: z.array(z.string()).default([]),
        metrics: z.array(metric).max(4).default([]),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        disclosure: z.enum(['mock-data']).optional(), // renders the mock-data notice on the page
        draft: z.boolean().default(false),
      })
      .refine((d) => !d.cover || !!d.coverAlt, { message: 'coverAlt is required when cover is set' }),
});

const proof = defineCollection({
  loader: file('src/content/proof-points.yaml'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string(), // one line
    year: z.number().int(),
    metric: z.string().optional(),
    order: z.number().int(),
    hidden: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  loader: glob({ base: './src/content/notes', pattern: '**/[^_]*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updated: z.coerce.date().optional(), // required for `now`, enforced in now.astro
  }),
});

const cv = defineCollection({
  loader: file('src/content/cv.yaml'),
  schema: z.object({
    id: z.string(),
    section: z.enum(['experience', 'education', 'skills']),
    title: z.string(),
    org: z.string().optional(),
    location: z.string().optional(),
    start: z.string().optional(), // "2024-12"
    end: z.string().optional(), // omit = present
    bullets: z.array(z.string()).default([]),
    order: z.number().int(),
  }),
});

export const collections = { work, proof, notes, pages, cv };
