import type { DefaultTheme } from 'vitepress';

import { ROLES, type Role } from '../catalog/packages.ts';

// Keyed by role, so a new role fails typecheck until it has a group; the renderer is no companion.
const COMPANIONS: Record<
  Exclude<Role, 'renderer'>,
  DefaultTheme.SidebarItem[]
> = {
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
    { text: 'Navigation API Plugin', link: '/packages/navigation-plugin' },
  ],
  server: [
    { text: 'Server', link: '/packages/server' },
    { text: 'Server-Side Rendering (SSR)', link: '/packages/ssr' },
  ],
  dx: [
    { text: 'Registry', link: '/packages/ui-router-registry' },
    { text: 'ESLint Plugin', link: '/packages/eslint-plugin' },
  ],
};

/** The Companion Packages sidebar groups, labelled and ordered by the catalog's roles. */
export const companionGroups = ROLES.flatMap(({ id, label }) =>
  id === 'renderer' ? [] : [{ role: id, text: label, items: COMPANIONS[id] }],
);
