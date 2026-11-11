// Data only: the examples index derives each example's facets from its own files (.vitepress/example-index.ts).
import type { mounts } from 'sample-app-routes';

/** What an example is, in the order the index lists them. */
export const EXAMPLE_KINDS = [
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'example', label: 'Examples' },
  { id: 'sample-app', label: 'Sample apps' },
] as const;

export type ExampleKind = (typeof EXAMPLE_KINDS)[number]['id'];

/** Example facets in display order; all but `kind` and `location` are the starter's options (#1554). */
export const EXAMPLE_FACETS = {
  kind: EXAMPLE_KINDS.map(({ id }) => id),
  lang: ['ts', 'js'],
  location: ['navigation', 'pushState', 'hash'],
  bindings: ['none', 'mobx', 'signals', 'effect'],
  render: ['client', 'prerender', 'server'],
  registry: ['on', 'off'],
  lint: ['on', 'off'],
} as const;

export type ExampleFacets = {
  [Key in keyof typeof EXAMPLE_FACETS]?: (typeof EXAMPLE_FACETS)[Key][number];
};

type AppMount = Extract<keyof typeof mounts, `/app${string}`>;

/** Each live sample-app mount and the app package it serves; keyed by mount, so a new /app* mount fails typecheck until it has a row. */
export const SAMPLE_APPS = {
  '/app': { label: 'Vanilla', app: 'sample-app-lit-vanilla' },
  '/app-mobx': { label: 'MobX', app: 'sample-app-lit-mobx' },
  '/app-effect': { label: 'Effect', app: 'sample-app-lit-effect' },
  '/app-signals': { label: 'Signals', app: 'sample-app-lit-signals' },
  '/app-hash': { label: 'Hash', app: 'sample-app-lit-vanilla' },
} as const satisfies Record<AppMount, { label: string; app: string }>;
