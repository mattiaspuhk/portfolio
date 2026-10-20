import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '@/config/site';
import { byPublishedDesc, getPublished } from '@/lib/content';

export async function GET(context: APIContext) {
  const notes = (await getPublished('notes')).sort(byPublishedDesc);
  return rss({
    title: site.name,
    description: site.description,
    site: context.site ?? site.url,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      pubDate: note.data.published,
      link: `/notes/${note.id}/`,
    })),
  });
}
