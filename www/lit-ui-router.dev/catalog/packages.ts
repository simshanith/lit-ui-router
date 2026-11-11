// Data only: the VitePress config and the docs worker both import it, so no node, DOM or vitepress imports.

/** Package roles, in the order every list shows them. */
export const ROLES = [
  { id: 'renderer', label: 'Renderer' },
  { id: 'reactivity', label: 'Reactivity' },
  { id: 'location', label: 'Location' },
  { id: 'server', label: 'Server' },
  { id: 'dx', label: 'DX' },
] as const;

export type Role = (typeof ROLES)[number]['id'];

/** Each published package's role, in display order within that role. */
export const PACKAGES = [
  { name: 'lit-ui-router', role: 'renderer' },
  { name: 'ui-router-effect', role: 'reactivity' },
  { name: 'lit-ui-router-effect', role: 'reactivity' },
  { name: 'ui-router-mobx', role: 'reactivity' },
  { name: 'lit-ui-router-mobx', role: 'reactivity' },
  { name: 'ui-router-signals', role: 'reactivity' },
  { name: 'lit-ui-router-signals', role: 'reactivity' },
  { name: 'ui-router-navigation-location-plugin', role: 'location' },
  { name: 'ui-router-server', role: 'server' },
  { name: 'lit-ui-router-ssr', role: 'server' },
  { name: 'ui-router-registry', role: 'dx' },
  { name: 'eslint-plugin-lit-ui-router', role: 'dx' },
] as const satisfies readonly { name: string; role: Role }[];

export type PackageName = (typeof PACKAGES)[number]['name'];
