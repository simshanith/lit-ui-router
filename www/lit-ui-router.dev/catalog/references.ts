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
  'eslint-plugin-lit-ui-router': null,
} as const satisfies Record<PackageName, string | null>;
