// The page router's states: each mount's route table with views, ledger resolves and responders attached.
import type { StateDeclaration, Transition } from '@uirouter/core';
import type { LitStateDeclaration, UIViewResolves } from 'lit-ui-router/pure';
import { mergeSearch } from 'ui-router-server';

import { type CacheKey, FRESH_MS, urlKey } from './edge-cache.ts';
import {
  type LedgerPackage,
  type LedgerReader,
  type LedgerVersion,
  latestOf,
  packagesOf,
  versionIn,
  versionsOf,
} from './ledger.ts';
import { GH_MOUNT, ghRoutes, RELEASES_MOUNT, releaseRoutes } from './routes.ts';
import {
  NotFoundView,
  PackageView,
  ReleasesView,
  releaseUrl,
  VersionView,
} from './views.ts';

type Route = (typeof releaseRoutes)[number] | (typeof ghRoutes)[number];

type RouteName = Route['name'];

type ResponseName = Extract<Route, { response: true }>['name'];

/** What each state's view or responder reads from its resolves. */
interface ResolvesOf {
  releases: { packages: readonly LedgerPackage[] };
  'releases.package': { versions: LedgerVersion[] };
  'releases.package.latest': { latest: LedgerVersion };
  'releases.package.version': { release: LedgerVersion };
  githubRelease: { latest: LedgerVersion };
  notFound: object;
}

/** What a response state's `respond` reads. */
export interface RespondContext<Resolves = UIViewResolves> {
  resolves: Resolves;
  request: Request;
}

/** A state as the page router registers it; a response state carries `respond`. */
export interface ReleaseState extends StateDeclaration {
  name: string;
  response?: true;
  /** Set on a response state whose answer the edge may cache; absent, every request reaches the ledger. */
  cacheKey?: CacheKey;
  // Method syntax: each state reads its own resolves, which the transition hands over untyped, as a view's are.
  respond?(context: RespondContext): Response;
}

type Attached = {
  [Name in RouteName]: Omit<LitStateDeclaration<ResolvesOf[Name]>, 'name'> &
    (Name extends ResponseName
      ? {
          respond: (context: RespondContext<ResolvesOf[Name]>) => Response;
          cacheKey?: CacheKey;
        }
      : object);
};

// SAFETY: every param these states declare is a string, and the url sets each one.
const paramsOf = (trans: Transition) =>
  trans.params() as { pkg: string; version: string };

const versionPath = ({ name, version }: LedgerVersion): string =>
  `${RELEASES_MOUNT}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/`;

const found = (location: string, maxAge = 300): Response =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });

const latestResolve = (ledger: LedgerReader) => ({
  token: 'latest',
  deps: ['$transition$'],
  resolveFn: (trans: Transition) => latestOf(ledger)(paramsOf(trans)),
});

const attach = (ledger: LedgerReader): Attached => ({
  releases: {
    component: ReleasesView,
    resolve: [{ token: 'packages', resolveFn: packagesOf(ledger) }],
  },
  'releases.package': {
    component: PackageView,
    resolve: [
      {
        token: 'versions',
        deps: ['$transition$'],
        resolveFn: (trans: Transition) => versionsOf(ledger)(paramsOf(trans)),
      },
    ],
  },
  'releases.package.latest': {
    resolve: [latestResolve(ledger)],
    respond: ({ resolves, request }) =>
      found(
        mergeSearch(versionPath(resolves.latest), new URL(request.url).search),
      ),
  },
  'releases.package.version': {
    component: VersionView,
    resolve: [
      {
        token: 'release',
        deps: ['versions', '$transition$'],
        resolveFn: (versions: LedgerVersion[], trans: Transition) =>
          versionIn(versions, paramsOf(trans)),
      },
    ],
  },
  githubRelease: {
    resolve: [latestResolve(ledger)],
    cacheKey: urlKey,
    respond: ({ resolves, request }) =>
      found(
        releaseUrl(resolves.latest) ??
          mergeSearch(
            versionPath(resolves.latest),
            new URL(request.url).search,
          ),
        FRESH_MS / 1000,
      ),
  },
  notFound: { component: NotFoundView },
});

/** The states of the tree at `mount` for one request, reading `ledger`. */
export const releaseStates = (
  mount: string,
  ledger: LedgerReader,
): ReleaseState[] => {
  const attached = attach(ledger);
  const routes = mount === GH_MOUNT ? ghRoutes : releaseRoutes;

  return routes.map((route) => ({ ...route, ...attached[route.name] }));
};
