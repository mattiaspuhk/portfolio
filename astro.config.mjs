import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://example.com', // TODO(mattias): final domain (sitemap, RSS and canonical URLs depend on it)
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  fonts: [
    // TODO(mattias): placeholder families
    { provider: fontProviders.fontsource(), name: 'Inter', cssVariable: '--font-body' },
    { provider: fontProviders.fontsource(), name: 'JetBrains Mono', cssVariable: '--font-code' },
  ],
  vite: { plugins: [tailwindcss()] },
});
