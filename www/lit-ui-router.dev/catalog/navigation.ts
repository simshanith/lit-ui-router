// Data only: .vitepress/config.ts hands it to VitePress as the sidebar and nav, attaching the generated API references.
import { SAMPLE_APPS } from './examples.ts';
import { PACKAGES, ROLES, type PackageName, type Role } from './packages.ts';

/** A page link, in VitePress's shape. */
export interface NavLink {
  text: string;
  link: string;
  target?: string;
}

/** A sidebar entry, in VitePress's shape. */
export interface SidebarEntry {
  text: string;
  link?: string;
  target?: string;
  collapsed?: boolean;
  items?: SidebarEntry[];
}

/** The Guides sidebar groups, in sidebar order; a guide's `topic` names one. */
export const GUIDE_TOPICS = [
  { id: 'urls', label: 'URLs & Location' },
  { id: 'server', label: 'Server-side' },
  { id: 'transitions', label: 'Transitions & Guards' },
  { id: 'markup', label: 'Links & Markup' },
  { id: 'builds', label: 'Builds & Diagnostics' },
  { id: 'reactivity', label: 'Reactivity' },
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number]['id'];

// Keyed by topic, so a new topic fails typecheck until it has a group.
const GUIDES: Record<GuideTopic, NavLink[]> = {
  urls: [
    { text: 'Location Plugins', link: '/guides/location-plugins' },
    { text: 'Unmatched URLs (404)', link: '/guides/unmatched-urls' },
  ],
  server: [
    { text: 'Server-Side Routing', link: '/guides/server-route-matching' },
    { text: 'Prerender with Vite', link: '/guides/prerender-with-vite' },
    {
      text: 'Prerender with Eleventy',
      link: '/guides/prerender-with-eleventy',
    },
  ],
  transitions: [
    { text: 'Route Guards', link: '/guides/route-guards' },
    {
      text: 'Loading and Error Views',
      link: '/guides/loading-and-error-views',
    },
    { text: 'Component Lifecycle Hooks', link: '/guides/component-lifecycle' },
    { text: 'Routed Components', link: '/guides/routed-components' },
  ],
  markup: [
    { text: 'Named Views', link: '/guides/named-views' },
    { text: 'View Fallback Content', link: '/guides/view-fallback-content' },
    { text: 'Design System Links', link: '/guides/design-system-links' },
  ],
  builds: [
    {
      text: 'Development and Production Builds',
      link: '/guides/development-builds',
    },
  ],
  reactivity: [
    { text: 'Reactive Components', link: '/guides/reactive-components' },
  ],
};

/** A topic's hub page, which its sidebar group heading links. */
const GUIDE_HUBS: Partial<Record<GuideTopic, string>> = {
  server: '/guides/server',
};

/** One Guides sidebar group per topic, labelled and ordered by the vocabulary. */
export const guideGroups = GUIDE_TOPICS.map(({ id, label }) => ({
  topic: id,
  text: label,
  link: GUIDE_HUBS[id],
  items: GUIDES[id],
}));

// Keyed by role, so a new role fails typecheck until it has a group.
const PACKAGE_PAGES: Record<Role, SidebarEntry[]> = {
  renderer: [{ text: 'lit-ui-router', link: '/packages/lit-ui-router' }],
  reactivity: [
    {
      text: 'Effect',
      link: '/packages/effect',
      collapsed: true,
      items: [
        { text: 'ui-router-effect', link: '/packages/ui-router-effect' },
        {
          text: 'lit-ui-router-effect',
          link: '/packages/lit-ui-router-effect',
        },
      ],
    },
    {
      text: 'MobX',
      link: '/packages/mobx',
      collapsed: true,
      items: [
        { text: 'ui-router-mobx', link: '/packages/ui-router-mobx' },
        { text: 'lit-ui-router-mobx', link: '/packages/lit-ui-router-mobx' },
      ],
    },
    {
      text: 'Signals',
      link: '/packages/signals',
      collapsed: true,
      items: [
        { text: 'ui-router-signals', link: '/packages/ui-router-signals' },
        {
          text: 'lit-ui-router-signals',
          link: '/packages/lit-ui-router-signals',
        },
      ],
    },
  ],
  location: [
    {
      text: 'Navigation API Plugin',
      link: '/packages/ui-router-navigation-location-plugin',
    },
  ],
  server: [
    { text: 'Server', link: '/packages/ui-router-server' },
    {
      text: 'Server-Side Rendering (SSR)',
      link: '/packages/lit-ui-router-ssr',
    },
  ],
  dx: [
    { text: 'Registry', link: '/packages/ui-router-registry' },
    { text: 'ESLint Plugin', link: '/packages/eslint-plugin-lit-ui-router' },
  ],
};

/** The Packages sidebar groups, labelled and ordered by the catalog's roles. */
export const packageGroups = ROLES.map(({ id, label }) => ({
  role: id,
  text: label,
  items: PACKAGE_PAGES[id],
}));

// The top nav and the sidebar both list these.
const sampleAppItems: NavLink[] = [
  { text: 'Overview', link: '/sample-app' },
  ...Object.entries(SAMPLE_APPS).map(([link, { label: text }]) => ({
    text,
    link,
    target: '_self',
  })),
];

/** Each package's API reference index; keyed by package, so a new catalog entry fails typecheck until it has a link or null. */
export const API_REFERENCES = {
  'lit-ui-router': '/reference/lit-ui-router/',
  'ui-router-effect': '/reference/ui-router-effect/',
  'lit-ui-router-effect': '/reference/lit-ui-router-effect/',
  'ui-router-mobx': '/reference/ui-router-mobx/',
  'lit-ui-router-mobx': '/reference/lit-ui-router-mobx/',
  'ui-router-signals': '/reference/ui-router-signals/',
  'lit-ui-router-signals': '/reference/lit-ui-router-signals/',
  'ui-router-navigation-location-plugin':
    '/reference/ui-router-navigation-location-plugin/',
  'ui-router-server': '/reference/ui-router-server/',
  'lit-ui-router-ssr': '/reference/lit-ui-router-ssr/',
  'ui-router-registry': '/reference/ui-router-registry/',
  'eslint-plugin-lit-ui-router': null,
} as const satisfies Record<PackageName, string | null>;

/** The sidebar sections, in order; each API reference entry gets its generated members in config.ts. */
export const SIDEBAR: SidebarEntry[] = [
  {
    text: 'Introduction',
    items: [{ text: 'What is Lit UI Router?', link: '/introduction' }],
  },
  {
    text: 'Tutorial',
    collapsed: true,
    items: [
      { text: 'Hello World', link: '/tutorial/helloworld' },
      { text: 'Hello Solar System', link: '/tutorial/hellosolarsystem' },
      { text: 'Hello Galaxy', link: '/tutorial/hellogalaxy' },
      { text: 'All Examples', link: '/examples/' },
      { text: 'Live Examples', link: '/examples/live' },
    ],
  },
  {
    // page-meta.test.ts holds the groups to guides/index.md and each guide's topic.
    text: 'Guides',
    collapsed: true,
    items: [
      { text: 'Overview', link: '/guides/' },
      ...guideGroups.map(({ text, link, items }) => ({
        text,
        link,
        collapsed: false,
        items,
      })),
    ],
  },
  { text: 'Releases', link: '/releases/', target: '_self', items: [] },
  {
    text: 'Packages',
    collapsed: true,
    items: [
      { text: 'Overview', link: '/packages/' },
      ...packageGroups.map(({ text, items }) => ({
        text,
        collapsed: false,
        items,
      })),
    ],
  },
  { text: 'Sample App', collapsed: true, items: sampleAppItems },
  {
    text: 'API',
    collapsed: true,
    items: [
      { text: 'Overview', link: '/reference/' },
      ...ROLES.map(({ id, label }) => ({
        text: label,
        collapsed: false,
        items: PACKAGES.flatMap(({ name, role }) => {
          const link = role === id ? API_REFERENCES[name] : null;

          return link ? [{ text: name, link, collapsed: true }] : [];
        }),
      })),
    ],
  },
  {
    text: 'Site',
    collapsed: true,
    items: [{ text: 'How this site runs', link: '/site/' }],
  },
];

/** The top nav: links, and menus of links. */
export const NAV: (NavLink | { text: string; items: NavLink[] })[] = [
  { text: 'Home', link: '/' },
  {
    text: 'Docs',
    items: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Tutorial', link: '/tutorial/helloworld' },
      { text: 'Guides', link: '/guides/' },
      { text: 'Releases', link: '/releases/', target: '_self' },
      { text: 'Packages', link: '/packages/' },
      { text: 'API', link: '/reference/' },
    ],
  },
  { text: 'Sample App', items: sampleAppItems },
  { text: 'Atlas', link: 'https://atlas.lit-ui-router.dev' },
];
