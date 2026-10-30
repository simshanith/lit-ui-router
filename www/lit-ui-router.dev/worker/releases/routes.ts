// The /releases and /gh mounts: route tables that both the verdict and the page router compile.
import type { MountConfig, RouteDeclaration } from 'ui-router-server';

export const RELEASES_MOUNT = '/releases';

export const GH_MOUNT = '/gh';

/** The trailing slash is optional on both sides; the worker redirects a page to the slashed spelling. */
export const urlConfig = { strict: false } as const;

export const releaseRoutes = [
  { name: 'releases', url: '' },
  { name: 'releases.package', url: '/{pkg}' },
  { name: 'releases.package.latest', url: '/latest', response: true },
  { name: 'releases.package.version', url: '/{version}' },
  { name: 'notFound' },
] as const satisfies readonly RouteDeclaration[];

/** Urls GitHub ought to have, each handing off to github.com. */
export const ghRoutes = [
  { name: 'githubRelease', url: '/releases/{pkg}/latest', response: true },
  { name: 'notFound' },
] as const satisfies readonly RouteDeclaration[];

export const mounts = {
  [RELEASES_MOUNT]: {
    routes: [...releaseRoutes],
    otherwise: { state: 'notFound' },
    config: urlConfig,
  },
  [GH_MOUNT]: {
    routes: [...ghRoutes],
    otherwise: { state: 'notFound' },
    config: urlConfig,
    ignoreDiagnostics: ['bareBaseNotFound'],
  },
} satisfies Record<string, MountConfig>;
