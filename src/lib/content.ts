import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

/**
 * All entries in dev. In production, drops `draft: true` (and `hidden: true`, used by `proof`).
 */
export async function getPublished<C extends CollectionKey>(name: C): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(name);
  if (!import.meta.env.PROD) return entries;
  return entries.filter((entry) => {
    const data = entry.data as { draft?: boolean; hidden?: boolean };
    return !data.draft && !data.hidden;
  });
}

export const byOrder = (a: { data: { order: number } }, b: { data: { order: number } }) =>
  a.data.order - b.data.order;

export const byPublishedDesc = (a: CollectionEntry<'notes'>, b: CollectionEntry<'notes'>) =>
  b.data.published.valueOf() - a.data.published.valueOf();

/** Previous and next published case studies by `order`. */
export async function getAdjacentWork(id: string) {
  const work = (await getPublished('work')).sort(byOrder);
  const index = work.findIndex((entry) => entry.id === id);
  return {
    prev: index > 0 ? work[index - 1] : undefined,
    next: index >= 0 && index < work.length - 1 ? work[index + 1] : undefined,
  };
}
