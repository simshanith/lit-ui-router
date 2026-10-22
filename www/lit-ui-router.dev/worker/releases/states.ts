// The page router's states: each mount's route table with views and ledger resolves attached, and its response states' handlers by name.
import type { StateDeclaration, Transition } from '@uirouter/core';
import type { LitStateDeclaration } from 'lit-ui-router/pure';
import type { ResponseHandlers } from 'lit-ui-router-ssr';
import { mergeSearch } from 'ui-router-server';
import type { ResponseState } from 'ui-router-server';

import { type CacheKey, FRESH_MS, urlKey } from './edge-cache.ts';
import {
  type LedgerPackage,
  type LedgerReader,
  type LedgerVersion,
  latestOf,
  NotInLedger,
  packagesOf,
  versionIn,
  versionsOf,
} from './ledger.ts';
import { GH_MOUNT, ghRoutes, RELEASES_MOUNT, releaseRoutes } from './routes.ts';
import {
  diffUrl,
  NotFoundView,
  PackageView,
  ReleasesView,
  releaseUrl,
  VersionView,
} from './views.ts';

type Route = (typeof releaseRoutes)[number] | (typeof ghRoutes)[number];

type RouteName = Route['name'];

type ResponseName = ResponseState<Route>;

/** What each state's view or responder reads from its resolves. */
interface ResolvesOf {
  releases: { packages: readonly LedgerPackage[] };
  'releases.package': { versions: LedgerVersion[] };
  'releases.package.latest': { latest: LedgerVersion };
  'releases.package.diff': { compare: string };
  'releases.package.version': {
    release: LedgerVersion;
    versions: LedgerVersion[];
  };
  githubRelease: { latest: LedgerVersion };
  notFound: object;
}

/** A state as the page router registers it. */
export interface ReleaseState extends StateDeclaration {
  name: string;
  /** Set on a response state whose answer the edge may cache; absent, every request reaches the ledger. */
  cacheKey?: CacheKey;
}

type Attached = {
  [Name in RouteName]: Omit<LitStateDeclaration<ResolvesOf[Name]>, 'name'> &
    (Name extends ResponseName ? { cacheKey?: CacheKey } : object);
};

// SAFETY: every param these states declare is a string, and the url sets each one.
const paramsOf = (trans: Transition) =>
  trans.params() as { pkg: string; version: string };

// SAFETY: an absent query param is undefined and a repeated one an array, neither of which names a version.
const diffParamsOf = (trans: Transition) =>
  trans.params() as { pkg: string; from: string; to: string; via: string };

const COMPARES = new Map([['diffshub', diffUrl]]);

/** The url `via` compares `from` with `to` at, or a `NotInLedger` rejection when either is unknown or lacks what `via` needs. */
const compareIn = (
  versions: readonly LedgerVersion[],
  { pkg, from, to, via }: ReturnType<typeof diffParamsOf>,
): string => {
  const url = COMPARES.get(via)?.(
    versionIn(versions, { pkg, version: from }),
    versionIn(versions, { pkg, version: to }),
  );

  if (!url) throw new NotInLedger(`${pkg}@${from}...${to} via ${via}`);

  return url;
};

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
  'releases.package.latest': { resolve: [latestResolve(ledger)] },
  'releases.package.diff': {
    resolve: [
      {
        token: 'compare',
        deps: ['versions', '$transition$'],
        resolveFn: (versions: LedgerVersion[], trans: Transition) =>
          compareIn(versions, diffParamsOf(trans)),
      },
    ],
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
  githubRelease: { resolve: [latestResolve(ledger)], cacheKey: urlKey },
  notFound: { component: NotFoundView },
});

/** Each response state's answer, bound by name. */
export const releaseResponses = {
  'releases.package.latest': ({ resolves, request }) =>
    found(
      mergeSearch(versionPath(resolves.latest), new URL(request.url).search),
    ),
  // It leaves the site, so the search stays behind.
  'releases.package.diff': ({ resolves }) => found(resolves.compare),
  githubRelease: ({ resolves, request }) =>
    found(
      releaseUrl(resolves.latest) ??
        mergeSearch(versionPath(resolves.latest), new URL(request.url).search),
      FRESH_MS / 1000,
    ),
} satisfies ResponseHandlers<Route, ResolvesOf>;

/** The states of the tree at `mount` for one request, reading `ledger`. */
export const releaseStates = (
  mount: string,
  ledger: LedgerReader,
): ReleaseState[] => {
  const attached = attach(ledger);
  const routes = mount === GH_MOUNT ? ghRoutes : releaseRoutes;

  return routes.map((route) => ({ ...route, ...attached[route.name] }));
};
