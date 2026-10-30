/**
 * The page's server-routing projection, for the docs worker and its dev
 * server: one mount whose root is the `search` state. Pure data.
 */
import type { MountConfig } from 'ui-router-server';

export const MOUNT = '/domain-search';

// `?q` is query-only, so every query answers with the one prerendered shell.
const search: MountConfig = {
  routes: [{ name: 'search', url: '?q' }],
  config: { strict: false },
};

export const mounts = { [MOUNT]: search } satisfies Record<string, MountConfig>;
