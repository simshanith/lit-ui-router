import type { ServerRouter } from './index.ts';

/**
 * Each `createServerRouter` router's compiled mounts in declaration order, for
 * `diagnoseMounts`. Its own module so the Vite plugin can ask whether a router
 * is one of them without importing the resolver's state.
 *
 * @internal
 */
export const compiledMounts: WeakMap<ServerRouter, unknown> = new WeakMap();
