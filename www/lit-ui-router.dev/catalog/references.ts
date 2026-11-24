// Data only: the VitePress config and the docs worker both import it, so no node, DOM or vitepress imports.
import type { PackageName } from './packages.ts';

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
  'ui-router-devtools': '/reference/ui-router-devtools/',
  'eslint-plugin-lit-ui-router': null,
} as const satisfies Record<PackageName, string | null>;

/** A custom elements page: the page source, and the link a rewrite serves it at inside the package's reference, which docs:api empties. */
export interface ElementReference {
  source: string;
  link: string;
}

/** The packages with a custom elements page, read from the Custom Elements Manifest each one ships. */
export const ELEMENT_REFERENCES = {
  'lit-ui-router': {
    source: 'reference/lit-ui-router-elements.md',
    link: '/reference/lit-ui-router/elements',
  },
} as const satisfies Partial<Record<PackageName, ElementReference>>;

/** An export a package's reference index leads with; `element` is the custom element tag its class defines. */
export interface FeaturedExport {
  name: string;
  element?: string;
}

/** The exports a new reader needs first, by package; `.vitepress/test/reference-landing.test.ts` holds each to the generated reference. */
export const FEATURED_EXPORTS = {
  'lit-ui-router': [
    { name: 'UIRouterLit' },
    { name: 'UIRouterLitElement', element: 'ui-router' },
    { name: 'UiView', element: 'ui-view' },
    { name: 'uiSref' },
    { name: 'uiSrefActive' },
    { name: 'TransitionController' },
    { name: 'LitStateDeclaration' },
  ],
  'ui-router-devtools': [
    { name: 'DevtoolsPlugin' },
    { name: 'UIRouterDevtools', element: 'ui-router-devtools' },
    { name: 'record' },
  ],
} as const satisfies Partial<Record<PackageName, readonly FeaturedExport[]>>;
