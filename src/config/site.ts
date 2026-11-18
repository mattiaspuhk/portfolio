/**
 * Site identity, navigation and every UI string. Components read their labels from here.
 * Empty `href`/`email` values are not rendered, so there are no broken links until they're filled in.
 */

export const site = {
  name: 'Mattias Puhk',
  url: import.meta.env.SITE, // set `site` in astro.config.mjs
  description:
    'Mattias Puhk, a product engineer from Estonia, now in London doing an MSc at LSE.',
  email: 'mattias.puhk@gmail.com',

  socials: [
    { label: 'GitHub', href: 'https://github.com/mattiaspuhk' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mattias-puhk' },
  ],

  // `collection`: the item hides from the dock while that collection has nothing published.
  // `match`: the path the item counts as current under, when `href` isn't a page of its own.
  nav: [
    { label: 'Work', href: '/#home-work', match: '/work', collection: 'work' },
    { label: 'Now', href: '/#home-now' },
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
    concept: '', // notice on case studies with `disclosure: concept`; hidden while empty
    beatNav: 'On this page', // aria-label of the case study beat nav
    pager: { label: 'More case studies', prev: 'Previous', next: 'Next' },
    back: 'Back', // link at the top of every page but home
    summary: {
      org: 'Company',
      role: 'Role',
      period: 'When',
      stack: 'Stack',
      readTime: 'Length',
      tldr: 'Short version',
    },
    metric: { before: 'Before', after: 'After' }, // screen-reader text around before → after
    // The `kind` of a case study: the work palette's groups, in this order.
    kind: {
      production: 'In production',
      sprint: 'Sprint week',
      hackathon: 'Hackathon',
      concept: 'Concept',
    },
    decision: { options: 'Ruled out', chose: 'Went with' },
    home: {
      introTitle: 'Mattias Puhk, a product engineer.',
      introTitleRole: 'a product engineer.', // the end of introTitle, on its own line in the glowing ink
      intro: 'From Estonia 🇪🇪, now in London 🇬🇧 doing an MSc at LSE.',
      seeWork: 'See my work', // the hero's link down to the work section
      work: 'Work',
      palettePrompt: 'TODO(mattias)', // the static line at the top of the work palette, where a search field would be. Not an input: nothing can be typed.
      proof: 'More from the GAIA rebuild',
      now: 'Now',
    },
    cv: {
      download: 'Download PDF',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      activities: 'Activities & Interests',
    },
  },

  /** Titles and meta descriptions for pages that aren't backed by an MDX file. */
  pages: {
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
