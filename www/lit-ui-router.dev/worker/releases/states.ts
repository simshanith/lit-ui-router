// The page router's states: the /gh route table with views and ledger resolves attached.
import type { StateDeclaration, Transition } from '@uirouter/core';
import type { LitStateDeclaration } from 'lit-ui-router/pure';

import {
  type LedgerPackage,
  type LedgerReader,
  type LedgerVersion,
  latestVersionOf,
  packagesOf,
  versionIn,
  versionsOf,
} from './ledger.ts';
import { routes } from './routes.ts';
import {
  NotFoundView,
  PackageView,
  ReleasesView,
  VersionView,
} from './views.ts';

type RouteName = (typeof routes)[number]['name'];

/** What each state's view reads from its resolves. */
interface ResolvesOf {
  releases: { packages: readonly LedgerPackage[] };
  'releases.package': { versions: LedgerVersion[] };
  'releases.package.latest': object;
  'releases.package.version': { release: LedgerVersion };
  notFound: object;
}

type Attached = {
  [Name in RouteName]: Omit<LitStateDeclaration<ResolvesOf[Name]>, 'name'>;
};

// SAFETY: every param these states declare is a string, and the url sets each one.
const paramsOf = (trans: Transition) =>
  trans.params() as { pkg: string; version: string };

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
    redirectTo: async (trans: Transition) => ({
      state: 'releases.package.version',
      params: {
        pkg: paramsOf(trans).pkg,
        version: await latestVersionOf(ledger)(paramsOf(trans)),
      },
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
  notFound: { component: NotFoundView },
});

/** The states for one request, reading `ledger`. */
export const releaseStates = (ledger: LedgerReader): StateDeclaration[] => {
  const attached = attach(ledger);

  return routes.map((route) => ({ ...route, ...attached[route.name] }));
};
