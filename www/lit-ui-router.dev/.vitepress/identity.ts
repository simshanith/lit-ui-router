import type { HeadConfig } from 'vitepress';

/** The PNGs `scripts/render-identity.ts` renders into `public/`, keyed by their SVG source in `scripts/identity/`. */
export const RENDERED_IMAGES = {
  'social-card.svg': {
    path: '/images/social-card.png',
    width: 1200,
    height: 630,
  },
  'apple-touch-icon.svg': {
    path: '/apple-touch-icon.png',
    width: 180,
    height: 180,
  },
} as const;

export const SOCIAL_CARD = {
  ...RENDERED_IMAGES['social-card.svg'],
  alt: 'Lit UI Router: State-based routing for Lit. A UI-Router implementation for Lit web components.',
} as const;

/** VitePress's default `--vp-c-bg` in each appearance. */
export const THEME_COLOR = { light: '#ffffff', dark: '#1b1b1f' } as const;

export const identityHead: HeadConfig[] = [
  ['link', { rel: 'icon', href: '/favicon.ico', sizes: '256x256' }],
  [
    'link',
    { rel: 'icon', href: '/images/lit-ui-router.svg', type: 'image/svg+xml' },
  ],
  [
    'link',
    {
      rel: 'apple-touch-icon',
      href: RENDERED_IMAGES['apple-touch-icon.svg'].path,
    },
  ],
  // VitePress dedupes a meta tag by its first non-content attribute, so media leads
  ...(['light', 'dark'] as const).map((scheme): HeadConfig => [
    'meta',
    {
      media: `(prefers-color-scheme: ${scheme})`,
      name: 'theme-color',
      content: THEME_COLOR[scheme],
    },
  ]),
];
