import type { DefaultTheme } from 'vitepress';

import { GUIDE_TOPICS, type GuideTopic } from './page-meta.ts';

type GuideLink = Required<Pick<DefaultTheme.SidebarItem, 'text' | 'link'>>;

// Keyed by topic, so a new topic fails typecheck until it has a group.
const GUIDES: Record<GuideTopic, GuideLink[]> = {
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

/** One Guides sidebar group per topic, labelled and ordered by the vocabulary. */
export const guideGroups = GUIDE_TOPICS.map(({ id, label }) => ({
  topic: id,
  text: label,
  items: GUIDES[id],
}));
