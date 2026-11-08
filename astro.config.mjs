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
    // Inter sets everything, picked by Mattias. A weight range loads the variable font, which also
    // carries the optical-size axis: display sizes get Inter's tighter display cut on their own.
    // 300 for the home headline; 500 and 600 for stand titles, tags and figures on the apron.
    { provider: fontProviders.fontsource(), name: 'Inter', cssVariable: '--font-body', weights: ['300 600'] },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-code',
      fallbacks: ['monospace'], // Astro defaults to sans-serif
    },
  ],
  vite: { plugins: [tailwindcss()] },
});
