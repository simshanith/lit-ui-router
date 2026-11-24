// Data only: the site footer's links. navigation.ts takes the Project links from here; test/footer.test.ts holds the rest to its sidebar labels and the copyright line to LICENSE.
// Each URL is written whole: `mise run check_links` reads them from this file.
import type { NavLink } from './navigation.ts';

// `_self` marks a path VitePress has no page for: the worker's release pages and a generated file.
const LINKS = {
  releases: { text: 'Releases', link: '/releases/', target: '_self' },
  sampleApp: { text: 'Sample App', link: '/sample-app' },
  atlas: { text: 'Atlas', link: 'https://atlas.lit-ui-router.dev' },
  issues: {
    text: 'Issues',
    link: 'https://github.com/simshanith/lit-ui-router/issues',
  },
  npm: { text: 'npm', link: 'https://npmx.dev/package/lit-ui-router' },
  site: { text: 'How this site runs', link: '/site/' },
  llms: { text: 'llms.txt', link: '/llms.txt', target: '_self' },
} as const satisfies Record<string, NavLink>;

/** The links the footer's Project group and the top nav's Project menu share; both list them in this order. */
export const PROJECT_LINKS = {
  releases: LINKS.releases,
  sampleApp: LINKS.sampleApp,
  atlas: LINKS.atlas,
} as const satisfies Record<string, NavLink>;

/** The compact bar's links, on every page but the home page. */
export const FOOTER_BAR: readonly NavLink[] = [
  LINKS.releases,
  LINKS.issues,
  LINKS.npm,
  LINKS.site,
  LINKS.llms,
];

/** A titled list of links in the home page's footer. */
export interface FooterGroup {
  id: string;
  title: string;
  links: readonly NavLink[];
}

/** The home page footer's groups; the top nav already leads to the docs sections. Issues is the footer's alone. */
export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    id: 'project',
    title: 'Project',
    links: [...Object.values(PROJECT_LINKS), LINKS.issues],
  },
  {
    id: 'resources',
    title: 'Resources',
    links: [LINKS.npm, LINKS.site, LINKS.llms],
  },
];

/** The pages the footer's sentences link. */
export const FOOTER_REFERENCES = {
  uiRouter: 'https://ui-router.github.io/',
  lit: 'https://lit.dev/',
  core: 'https://github.com/ui-router/core',
  license: 'https://github.com/simshanith/lit-ui-router/blob/main/LICENSE',
} as const;

/** LICENSE's copyright years and holder. */
export const COPYRIGHT = '2024-present Lit UI-Router Team';
