/**
 * Site identity, navigation and every UI string. Components read their labels from here.
 * Empty `href`/`email` values are not rendered, so there are no broken links until they're filled in.
 */

export const site = {
  name: 'Mattias Puhk',
  url: import.meta.env.SITE, // set `site` in astro.config.mjs
  description:
    'Mattias Puhk is a full-stack engineer in London. Case studies of the AI features he built for GAIA, with the decisions behind them and what broke.',
  email: 'mattias.puhk@gmail.com',

  socials: [
    { label: 'GitHub', href: '' }, // TODO(mattias)
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mattias-puhk' },
  ],

  nav: [
    { label: 'Work', href: '/work' },
    { label: 'Notes', href: '/notes' },
    { label: 'Now', href: '/now' },
    { label: 'About', href: '/about' },
    { label: 'CV', href: '/cv' },
  ],

  labels: {
    skipLink: 'Skip to content',
    mainNav: 'Main', // aria-label of the header nav
    footerNav: 'Contact', // aria-label of the footer links
    email: 'Email', // text of the footer email link
    themeToggle: 'Dark mode', // accessible name; the button reads as pressed while dark theme is on
    readTime: (minutes: number) => `${minutes} min read`,
    updated: 'Updated', // shown before an updated date
    present: 'Present', // end of a period with no end date
    mockData: 'Mock data', // small label on <Figure mock>
    mockDataNotice: 'Every screenshot on this page uses mock data, not customer data.', // notice on case studies with `disclosure: mock-data`
    concept: 'TODO(mattias)', // notice on case studies with `disclosure: concept`
    beatNav: 'On this page', // aria-label of the case study beat nav
    pager: { label: 'More case studies', prev: 'Previous', next: 'Next' },
    summary: {
      org: 'Company',
      role: 'Role',
      period: 'When',
      stack: 'Stack',
      readTime: 'Length',
      tldr: 'Short version',
    },
    metric: { before: 'Before', after: 'After' }, // screen-reader text around before → after
    decision: { options: 'Considered', chose: 'Went with' },
    home: {
      introTitle: 'Mattias Puhk, a product engineer.',
      introTitleRole: 'a product engineer.', // the end of introTitle, on its own line in the glowing ink
      intro: 'From Estonia 🇪🇪, now in London 🇬🇧 doing an MSc at LSE.',
      seeWork: 'See the work', // the hero's link down to Selected work
      work: 'Selected work',
      proof: 'More from the GAIA rebuild',
      now: 'Now',
      notes: 'Notes',
    },
    cv: {
      download: 'Download PDF',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
    },
  },

  /** Titles and meta descriptions for pages that aren't backed by an MDX file. */
  pages: {
    work: {
      title: 'Work',
      description:
        'Case studies of what Mattias Puhk built, with the decisions behind each one and what broke.',
    },
    notes: { title: 'Notes', description: 'Shorter pieces by Mattias Puhk on building software.' },
    cv: { title: 'CV', description: "Mattias Puhk's education, experience and skills." },
    notFound: {
      title: 'Page not found',
      description: "There's no page at this address.",
      body: 'The link may be old, or the page may have moved.',
      homeLink: 'Go to the home page',
    },
  },
} as const;

export type NavItem = (typeof site.nav)[number];
