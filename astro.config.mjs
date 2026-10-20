import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import { remarkReadingTime } from './src/lib/remark-reading-time.mjs';

export default defineConfig({
  site: 'https://example.com', // TODO(mattias): final domain (sitemap, RSS and canonical URLs depend on it)
  integrations: [mdx(), sitemap()],
  markdown: {
    // Astro 7's default processor (Sätteri) doesn't run remark plugins; MDX inherits this one.
    processor: unified({ remarkPlugins: [remarkReadingTime] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  fonts: [
    // TODO(mattias): placeholder families
    { provider: fontProviders.fontsource(), name: 'Inter', cssVariable: '--font-body' },
    { provider: fontProviders.fontsource(), name: 'JetBrains Mono', cssVariable: '--font-code' },
  ],
  vite: { plugins: [tailwindcss()] },
});
