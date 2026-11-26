// Data only: the VitePress config and the docs worker both import it, so no node, DOM or vitepress imports.

/** Package roles, in the order every list shows them. */
export const ROLES = [
  { id: 'renderer', label: 'Renderer' },
  { id: 'reactivity', label: 'Reactivity' },
  { id: 'location', label: 'Location' },
  { id: 'server', label: 'Server' },
  { id: 'dx', label: 'DX' },
  { id: 'observability', label: 'Observability' },
] as const;

export type Role = (typeof ROLES)[number]['id'];

/** What a package is about: the router, or Lit tooling with no router dependency. */
export const SUBJECTS = ['router', 'lit'] as const;

export type Subject = (typeof SUBJECTS)[number];

/** `agnostic` peers on `@uirouter/core` and its runtime only; `lit` also peers on `lit` or `lit-ui-router`. */
export const LAYERS = ['agnostic', 'lit'] as const;

export type Layer = (typeof LAYERS)[number];

/** Where a package's code runs. */
export const RUNTIMES = [
  'browser',
  'server',
  'build',
  'type-check',
  'editor',
  'ci',
] as const;

export type Runtime = (typeof RUNTIMES)[number];

/** A published package's curated facets; `.vitepress/test/package-index.test.ts` holds them to each package.json. */
export interface PackageEntry {
  name: string;
  role: Role;
  subject: Subject;
  /** Absent for subject `lit`. */
  layer?: Layer;
  runtime: readonly Runtime[];
}

/** Each published package, in display order within its role. */
export const PACKAGES = [
  {
    name: 'lit-ui-router',
    role: 'renderer',
    subject: 'router',
    layer: 'lit',
    runtime: ['browser'],
  },
  {
    name: 'ui-router-effect',
    role: 'reactivity',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser'],
  },
  {
    name: 'lit-ui-router-effect',
    role: 'reactivity',
    subject: 'router',
    layer: 'lit',
    runtime: ['browser'],
  },
  {
    name: 'ui-router-mobx',
    role: 'reactivity',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser'],
  },
  {
    name: 'lit-ui-router-mobx',
    role: 'reactivity',
    subject: 'router',
    layer: 'lit',
    runtime: ['browser'],
  },
  {
    name: 'ui-router-signals',
    role: 'reactivity',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser'],
  },
  {
    name: 'lit-ui-router-signals',
    role: 'reactivity',
    subject: 'router',
    layer: 'lit',
    runtime: ['browser'],
  },
  {
    name: 'ui-router-navigation-location-plugin',
    role: 'location',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser'],
  },
  {
    name: 'ui-router-server',
    role: 'server',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['server', 'build'],
  },
  {
    name: 'lit-ui-router-ssr',
    role: 'server',
    subject: 'router',
    layer: 'lit',
    runtime: ['browser', 'build'],
  },
  {
    name: 'ui-router-registry',
    role: 'dx',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['type-check'],
  },
  {
    name: 'ui-router-devtools',
    role: 'dx',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser'],
  },
  {
    // Peers only on eslint, so no peer decides its layer; it lints lit-ui-router templates.
    name: 'eslint-plugin-lit-ui-router',
    role: 'dx',
    subject: 'router',
    layer: 'lit',
    runtime: ['editor', 'ci'],
  },
  {
    name: 'ui-router-otel',
    role: 'observability',
    subject: 'router',
    layer: 'agnostic',
    runtime: ['browser', 'server'],
  },
] as const satisfies readonly PackageEntry[];

export type PackageName = (typeof PACKAGES)[number]['name'];

/** Packages whose page takes its sections from the README's regions; `.vitepress/test/readme-sourced.test.ts` holds each page to them. */
export const README_SOURCED: readonly PackageName[] = ['ui-router-registry'];

/** Narrows a name to a package the catalog lists. */
export const isPackageName = (name: string): name is PackageName =>
  PACKAGES.some((entry) => entry.name === name);

/** A package's docs page; `.vitepress/test/catalog.test.ts` holds each to its source file. */
export const packagePagePath = (name: PackageName): string =>
  `/packages/${name}`;
