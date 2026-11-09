// The /releases and /gh mounts: route tables that both the verdict and the page router compile.
import type { MountConfig, RouteDeclaration } from 'ui-router-server';
import type { RouterUrlConfig } from 'ui-router-server/url-config';

import { DEFAULT_FILTER, FILTER_PARAM } from './npm-diff/file-filter.ts';

export const RELEASES_MOUNT = '/releases';

export const GH_MOUNT = '/gh';

/** Pages live at the slashed spelling, as static assets do; response states keep the url they were asked for. */
export const urlConfig = {
  strict: false,
  trailingSlash: { pages: 'always' },
} as const satisfies RouterUrlConfig;

export const releaseRoutes = [
  { name: 'releases', url: '' },
  { name: 'releases.package', url: '/{pkg}' },
  { name: 'releases.package.latest', url: '/latest', response: true },
  {
    name: 'releases.package.diff',
    url: '/diff?from&to&via',
    params: { via: { value: 'diffshub', squash: true } },
    response: true,
  },
  {
    name: 'releases.package.compare',
    url: `/diff/{from}...{to}?${FILTER_PARAM}`,
    params: {
      [FILTER_PARAM]: { value: DEFAULT_FILTER, squash: true, dynamic: true },
    },
  },
  {
    name: 'releases.package.compare.index',
    url: '/{layout}/index.json',
    response: true,
  },
  {
    name: 'releases.package.compare.files',
    url: '/{layout}/files/{preset}',
    response: true,
  },
  {
    name: 'releases.package.compare.patch',
    url: '/{layout}/patch',
    response: true,
  },
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
