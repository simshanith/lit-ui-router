// The diff page's client router: the release route table under pushState, owning the page's preset and naming its data routes.
import { BrowserLocationConfig, pushStateLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import { applyUrlConfig } from 'ui-router-server/url-config';
import { LAYOUT } from '@www/release-diffs.lit-ui-router.dev/layout';

import {
  DEFAULT_FILTER,
  type FileFilter,
  FILTER_PARAM,
  filterNamed,
} from './npm-diff/file-filter.ts';
import { RELEASES_MOUNT, releaseRoutes, urlConfig } from './routes.ts';

const COMPARE = 'releases.package.compare';

/** The pair a diff page compares, as the route table names its params. */
export interface PairParams {
  pkg: string;
  from: string;
  to: string;
}

/** One of the compare state's data routes, by its name under the state. */
export type DataRoute =
  | { name: 'index' }
  | { name: 'patch' }
  | { name: 'files'; preset: FileFilter };

/** What the page asks of its router. */
export interface DiffRouter {
  /** Syncs to the page's url and keeps listening; `onPreset` runs for the preset each settled transition lands on, the first included. */
  start: (onPreset: (filter: FileFilter) => void) => void;
  /** Shows `filter` by a param transition that replaces the history entry. */
  choose: (filter: FileFilter) => void;
  /** The url of one of the pair's data routes under this build's layout. */
  dataUrl: (route: DataRoute) => URL;
}

/** A router for the page of `pair`, its states registered and not yet listening. */
export const diffRouter = (pair: PairParams): DiffRouter => {
  const router = applyUrlConfig(new UIRouterLit(), urlConfig);

  router.plugin(pushStateLocationPlugin);

  const { locationConfig } = router;

  if (!(locationConfig instanceof BrowserLocationConfig))
    throw new Error(
      'pushStateLocationPlugin installed no BrowserLocationConfig',
    );

  // The route table is mount-relative, as the server routes it.
  locationConfig.baseHref(`${RELEASES_MOUNT}/`);

  for (const route of releaseRoutes)
    router.stateRegistry.register(
      // The server matcher can't nest routes under a search param (#1951), so the preset is the client's alone.
      route.name === COMPARE
        ? {
            ...route,
            url: `${route.url}?${FILTER_PARAM}`,
            params: {
              [FILTER_PARAM]: {
                value: DEFAULT_FILTER,
                squash: true,
                dynamic: true,
              },
            },
          }
        : { ...route },
    );

  router.urlService.rules.otherwise({ state: 'notFound' });

  return {
    start: (onPreset) => {
      router.transitionService.onSuccess({ to: COMPARE }, (trans) => {
        // SAFETY: the compare state declares the preset param, a string.
        const { [FILTER_PARAM]: preset } = trans.params() as {
          [FILTER_PARAM]?: string;
        };

        onPreset(filterNamed(preset));
      });
      router.urlService.listen();
      router.urlService.sync();
    },
    choose: (filter) => {
      void router.stateService.go(
        COMPARE,
        { [FILTER_PARAM]: filter },
        { location: 'replace' },
      );
    },
    dataUrl: ({ name, ...params }) =>
      new URL(
        router.stateService.href(
          `${COMPARE}.${name}`,
          { ...pair, layout: LAYOUT, ...params },
          { inherit: false },
        ),
        location.origin,
      ),
  };
};
