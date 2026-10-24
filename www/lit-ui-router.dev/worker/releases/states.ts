// The page router's states: each mount's route table with views, ledger resolves and responders attached.
import type { StateDeclaration, Transition } from '@uirouter/core';
import type { LitStateDeclaration, UIViewResolves } from 'lit-ui-router/pure';
import { mergeSearch } from 'ui-router-server';

import type { DiffIndex, DiffPair, ReleaseDiffs } from './diff-data.ts';
import { type CacheKey, FRESH_MS, urlKey } from './edge-cache.ts';
import {
  type LedgerPackage,
  type LedgerReader,
  type LedgerVersion,
  latestOf,
  NotInLedger,
  packagesOf,
  type PublishedPair,
  versionIn,
  versionsOf,
} from './ledger.ts';
import { FILE_FILTERS, type FileFilter } from './npm-diff/file-filter.ts';
import { GH_MOUNT, ghRoutes, RELEASES_MOUNT, releaseRoutes } from './routes.ts';
import {
  CompareView,
  diffUrl,
  filesDiffPath,
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
  'releases.package.diff': { compare: string };
  'releases.package.compare': {
    pair: PublishedPair;
  };
  'releases.package.compare.index': { index: DiffIndex };
  'releases.package.compare.files': { files: ReadableStream<Uint8Array> };
  'releases.package.compare.patch': {
    pair: PublishedPair;
    patch: ReadableStream<Uint8Array>;
  };
  'releases.package.version': {
    release: LedgerVersion;
    versions: LedgerVersion[];
  };
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

// SAFETY: an absent query param is undefined and a repeated one an array, neither of which names a version.
const diffParamsOf = (trans: Transition) =>
  trans.params() as { pkg: string; from: string; to: string; via: string };

const COMPARES = new Map([
  ['diffshub', diffUrl],
  ['files', filesDiffPath],
]);

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

/** Both versions' rows, or a `NotInLedger` rejection when either is unknown or never reached npm. */
const publishedPairIn = (
  versions: readonly LedgerVersion[],
  { pkg, from, to }: ReturnType<typeof diffParamsOf>,
): PublishedPair => {
  const pair: PublishedPair = {
    from: versionIn(versions, { pkg, version: from }),
    to: versionIn(versions, { pkg, version: to }),
  };

  if (filesDiffPath(pair.from, pair.to) === null)
    throw new NotInLedger(`${pkg}@${from}...${to} on npm`);

  return pair;
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

const IMMUTABLE = 'public, max-age=31536000, immutable';

const PATCH_TYPE = 'text/x-diff; charset=utf-8';

/** A data route's answer: a pair's published files never change, so neither does it. */
const data = (
  body: string | ReadableStream<Uint8Array>,
  type: string,
  headers: Record<string, string> = {},
): Response =>
  new Response(body, {
    headers: { 'Content-Type': type, 'Cache-Control': IMMUTABLE, ...headers },
  });

/** The release-diffs worker's name for a pair the parent state found in the ledger. */
const diffPairOf = ({ from, to }: PublishedPair): DiffPair => ({
  name: to.name,
  from: from.version,
  to: to.version,
});

// SAFETY: the url sets the preset param, a string.
const presetParamOf = (trans: Transition) =>
  (trans.params() as { preset: string }).preset;

/** The preset the url names, or a `NotInLedger` rejection for an unknown one. */
const presetOf = (trans: Transition): FileFilter => {
  const preset = presetParamOf(trans);
  const filter = FILE_FILTERS.find((candidate) => candidate === preset);

  if (!filter) throw new NotInLedger(`no ${preset} preset`);

  return filter;
};

const patchFilename = ({ from, to }: PublishedPair): string =>
  `${to.name.replace('/', '-')}-${from.version}...${to.version}.patch`;

const attach = (ledger: LedgerReader, diffs: ReleaseDiffs): Attached => ({
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
  'releases.package.diff': {
    resolve: [
      {
        token: 'compare',
        deps: ['versions', '$transition$'],
        resolveFn: (versions: LedgerVersion[], trans: Transition) =>
          compareIn(versions, diffParamsOf(trans)),
      },
    ],
    // The search only names the pair, which the target spells in its own url.
    respond: ({ resolves }) => found(resolves.compare),
  },
  'releases.package.compare': {
    component: CompareView,
    resolve: [
      {
        token: 'pair',
        deps: ['versions', '$transition$'],
        resolveFn: (versions: LedgerVersion[], trans: Transition) =>
          publishedPairIn(versions, diffParamsOf(trans)),
      },
    ],
  },
  'releases.package.compare.index': {
    resolve: [
      {
        token: 'index',
        deps: ['pair'],
        resolveFn: (pair: PublishedPair) => diffs.index(diffPairOf(pair)),
      },
    ],
    cacheKey: urlKey,
    respond: ({ resolves }) =>
      data(JSON.stringify(resolves.index), 'application/json'),
  },
  'releases.package.compare.files': {
    resolve: [
      { token: 'preset', deps: ['$transition$'], resolveFn: presetOf },
      {
        token: 'files',
        deps: ['pair', 'preset'],
        resolveFn: (pair: PublishedPair, preset: FileFilter) =>
          diffs.files(diffPairOf(pair), preset),
      },
    ],
    cacheKey: urlKey,
    respond: ({ resolves }) => data(resolves.files, PATCH_TYPE),
  },
  'releases.package.compare.patch': {
    resolve: [
      {
        token: 'patch',
        deps: ['pair'],
        resolveFn: (pair: PublishedPair) => diffs.patch(diffPairOf(pair)),
      },
    ],
    cacheKey: urlKey,
    respond: ({ resolves }) =>
      data(resolves.patch, PATCH_TYPE, {
        'Content-Disposition': `attachment; filename="${patchFilename(resolves.pair)}"`,
      }),
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

/** The states of the tree at `mount` for one request, reading `ledger` and, for the diff page's data, `diffs`. */
export const releaseStates = (
  mount: string,
  ledger: LedgerReader,
  diffs: ReleaseDiffs,
): ReleaseState[] => {
  const attached = attach(ledger, diffs);
  const routes = mount === GH_MOUNT ? ghRoutes : releaseRoutes;

  return routes.map((route) => ({ ...route, ...attached[route.name] }));
};
