// The /gh mount: one route table that both the verdict and the page router compile.
import type { MountConfig, RouteDeclaration } from 'ui-router-server';

export const GH_MOUNT = '/gh';

/** The trailing slash is optional on both sides; the worker redirects to the slashed spelling. */
export const urlConfig = { strict: false } as const;

export const routes = [
  { name: 'releases', url: '/releases' },
  { name: 'releases.package', url: '/{pkg}' },
  { name: 'releases.package.latest', url: '/latest' },
  { name: 'releases.package.version', url: '/{version}' },
  { name: 'notFound' },
] as const satisfies readonly RouteDeclaration[];

export const ghMount: MountConfig = {
  routes: [...routes],
  redirects: [{ pattern: /^\/?$/, to: 'releases' }],
  otherwise: { state: 'notFound' },
  config: urlConfig,
};
