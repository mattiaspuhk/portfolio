/**
 * Site identity, navigation and every UI string. Components read their labels from here.
 * Empty `href`/`email` values are not rendered, so there are no broken links until they're filled in.
 */

const TODO = 'TODO(mattias)';

export const site = {
  name: 'Mattias Puhk',
  url: import.meta.env.SITE, // set `site` in astro.config.mjs
  description: TODO,
  email: '', // TODO(mattias)

  socials: [
    { label: 'GitHub', href: '' }, // TODO(mattias)
    { label: 'LinkedIn', href: '' }, // TODO(mattias)
  ],

  nav: [
    { label: 'Work', href: '/work' },
    { label: 'Notes', href: '/notes' },
    { label: 'Now', href: '/now' },
    { label: 'About', href: '/about' },
    { label: 'CV', href: '/cv' },
  ],

  labels: {
    skipLink: TODO,
    mainNav: TODO, // aria-label of the header nav
    footerNav: TODO, // aria-label of the footer links
    email: TODO, // text of the footer email link
    themeToggle: TODO, // accessible name; the button reads as pressed while dark theme is on
    readTime: (minutes: number) => `${minutes} ${TODO}`,
    updated: TODO, // shown before an updated date
    present: TODO, // end of a period with no end date
    mockData: TODO, // small label on <Figure mock>
    mockDataNotice: TODO, // notice on case studies with `disclosure: mock-data`
    beatNav: TODO, // aria-label of the case study beat nav
    pager: { label: TODO, prev: TODO, next: TODO },
    summary: { org: TODO, role: TODO, period: TODO, stack: TODO, readTime: TODO, tldr: TODO },
    metric: { before: TODO, after: TODO }, // screen-reader text around before → after
    decision: { options: TODO, chose: TODO },
    home: {
      introTitle: TODO,
      intro: TODO,
      work: TODO,
      proof: TODO,
      now: TODO,
      notes: TODO,
    },
    cv: { download: TODO, experience: TODO, education: TODO, skills: TODO },
  },

  /** Titles and meta descriptions for pages that aren't backed by an MDX file. */
  pages: {
    work: { title: TODO, description: TODO },
    notes: { title: TODO, description: TODO },
    cv: { title: TODO, description: TODO },
    notFound: { title: TODO, description: TODO, body: TODO, homeLink: TODO },
  },
} as const;

export type NavItem = (typeof site.nav)[number];
