import { ref } from 'vue';
import { brandMarks, type Brand } from './brands';

// one shared hover/focus selection linking spectrum points, legend, and cards
export const activeId = ref<string | null>(null);

export const levels = [
  { n: 0, name: 'Memory' },
  { n: 1, name: 'Hash' },
  { n: 2, name: '200 fallback' },
  { n: 3, name: 'Static rules' },
  { n: 4, name: 'Route-aware' },
  { n: 5, name: 'Full-stack' },
] as const;

export interface SpectrumPoint {
  level: (typeof levels)[number]['n'];
  label: string;
}

export interface FrameworkEntry {
  id: string;
  name: string;
  brand?: Brand;
  // mark override for entries outside the brand map (this repo's own stack)
  mark?: { light: string; dark: string; height: number };
  // rendered as a card only when a blurb exists; spectrum + legend show all
  blurb?: string;
  points: SpectrumPoint[];
}

// positions restate the page's claims; blurbs are the cards' text
export const frameworks: FrameworkEntry[] = [
  {
    id: 'react-router',
    name: 'React Router',
    brand: 'react-router',
    blurb:
      'Framework mode ships <code>ssr: true</code> by default — full server routing as the launch state — while the documented SPA mode opts out to level 2’s <code>/* /index.html 200</code> rule: one tool, both ends of the spectrum.',
    points: [
      { level: 2, label: 'SPA mode' },
      { level: 5, label: 'framework mode' },
    ],
  },
  {
    id: 'vue-router',
    name: 'Vue Router',
    brand: 'vue-router',
    blurb:
      'Its history-mode guide is the canonical level-2 documentation: the fallback that, by its own description, means the server will no longer report 404 errors.',
    points: [{ level: 2, label: 'history mode' }],
  },
  {
    id: 'angular',
    name: 'Angular',
    brand: 'angular',
    blurb:
      'Documents the same fallback rule for path-location deploys; honest statuses arrive through its SSR package rather than a route-aware edge.',
    points: [{ level: 2, label: 'guidance' }],
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    brand: 'nextjs',
    blurb:
      'SSR-default: the framework owns rendering, and full server routing is the default launch state — launching at the far end of the spectrum.',
    points: [{ level: 5, label: 'SSR default' }],
  },
  {
    id: 'svelte',
    name: 'SvelteKit',
    brand: 'svelte',
    blurb:
      'The same SSR-default class; turn SSR off and its adapters document a <code>200.html</code> fallback — the level-2 rule under another name.',
    points: [
      { level: 2, label: 'SSR off' },
      { level: 5, label: 'SSR default' },
    ],
  },
  {
    id: 'netlify',
    name: 'Netlify',
    brand: 'netlify',
    blurb:
      'The <code>/* /index.html 200</code> redirect: level 2 as a single line of platform config.',
    points: [{ level: 2, label: '/* 200 redirect' }],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    brand: 'cloudflare',
    blurb:
      'Pages assumes an SPA by default; Workers static assets host this very site, with the worker running only where a routing decision is needed.',
    points: [{ level: 2, label: 'Pages default' }],
  },
  {
    id: 'nginx',
    name: 'nginx',
    brand: 'nginx',
    blurb:
      '<code>try_files $uri /index.html;</code> is the level-2 rewrite; hand-maintained <code>error_page</code> and <code>location</code> blocks are the level-3/4 prior art whose maintenance this stack replaces with projected data.',
    points: [
      { level: 2, label: 'try_files' },
      { level: 3, label: 'error_page' },
      { level: 4, label: 'location blocks' },
    ],
  },
  {
    id: 'ui-router-server',
    name: 'ui-router-server (this stack)',
    mark: {
      light: '/images/lit-ui-router.svg',
      dark: '/images/lit-ui-router.svg',
      height: 30,
    },
    points: [
      { level: 3, label: 'static 404, kept' },
      { level: 4, label: 'flagship' },
      { level: 5, label: 'simulate' },
    ],
  },
];

export function markFor(entry: FrameworkEntry) {
  return entry.mark ?? brandMarks[entry.brand!];
}
