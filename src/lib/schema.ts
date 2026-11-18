/**
 * schema.org JSON-LD nodes for Seo.astro. Everything here is built from data that's already on
 * the site (site.ts, the CV and case study frontmatter), so there's no copy of its own to keep in sync.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '@/config/site';
import { getPublished } from '@/lib/content';

export type SchemaNode = Record<string, unknown>;

/**
 * The public URL of the page being built. With `build.format: 'file'`, Astro.url ends in ".html"
 * at build time; Vercel serves it without, so canonical and og:url drop it too.
 */
export function canonicalUrl(url: URL): URL {
  const path = url.pathname.replace(/(\/index)?\.html$/, '').replace(/(.)\/$/, '$1') || '/';
  return new URL(path, site.url);
}

const siteUrl = new URL('/', site.url).href;
export const personId = `${siteUrl}#person`;
export const websiteId = `${siteUrl}#website`;

/** "London School of Economics and Political Science (LSE)" → name and alternateName. */
function organization(org: string): SchemaNode {
  const match = org.match(/^(.*?)\s*\(([^)]+)\)$/);
  return match
    ? { '@type': 'CollegeOrUniversity', name: match[1], alternateName: match[2] }
    : { '@type': 'CollegeOrUniversity', name: org };
}

export async function person(): Promise<SchemaNode> {
  const cv = await getCollection('cv');
  const schools = cv
    .filter((e) => e.data.section === 'education' && e.data.org)
    .map((e) => organization(e.data.org!));
  const stacks = (await getPublished('work')).flatMap((e) => e.data.stack);
  const knowsAbout = [...new Set(stacks)];

  return {
    '@type': 'Person',
    '@id': personId,
    name: site.name,
    url: siteUrl,
    ...(site.email ? { email: `mailto:${site.email}` } : {}),
    homeLocation: { '@type': 'Place', name: 'London, United Kingdom' },
    nationality: { '@type': 'Country', name: 'Estonia' },
    ...(schools.length ? { alumniOf: schools } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    sameAs: site.socials.map((social) => social.href).filter(Boolean),
  };
}

export function website(): SchemaNode {
  return {
    '@type': 'WebSite',
    '@id': websiteId,
    name: site.name,
    url: siteUrl,
    description: site.description,
    inLanguage: 'en',
    author: { '@id': personId },
    publisher: { '@id': personId },
  };
}

/** Home → … → this page. `items` are the crumbs after Home; the last one is the current page. */
export function breadcrumbs(items: { name: string; url: string | URL }[]): SchemaNode {
  const all = [{ name: site.name, url: siteUrl }, ...items];
  return {
    '@type': 'BreadcrumbList',
    itemListElement: all.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: String(item.url),
    })),
  };
}

export function caseStudy(entry: CollectionEntry<'work'>, url: URL, image?: URL): SchemaNode {
  const { title, summary, tldr, period, stack } = entry.data;
  return {
    '@type': 'Article',
    '@id': `${url.href}#article`,
    headline: title,
    description: summary,
    ...(tldr ? { abstract: tldr } : {}),
    url: url.href,
    mainEntityOfPage: url.href,
    ...(image ? { image: image.href } : {}),
    author: { '@id': personId },
    publisher: { '@id': personId },
    isPartOf: { '@id': websiteId },
    inLanguage: 'en',
    // When the work happened, not when the page went up.
    temporalCoverage: `${period.start.toISOString().slice(0, 10)}/${period.end ? period.end.toISOString().slice(0, 10) : '..'}`,
    ...(stack.length ? { keywords: stack.join(', ') } : {}),
  };
}

export function profilePage(url: URL): SchemaNode {
  return {
    '@type': 'ProfilePage',
    '@id': `${url.href}#page`,
    url: url.href,
    mainEntity: { '@id': personId },
    isPartOf: { '@id': websiteId },
  };
}

/** One <script type="application/ld+json"> body. Escapes "<" so values can't close the tag. */
export function toJsonLd(nodes: SchemaNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(
    /</g,
    '\\u003c',
  );
}
