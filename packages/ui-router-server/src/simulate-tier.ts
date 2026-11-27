// The simulate strategy, behind its lazy boundary: @uirouter/core enters the module graph only through the import() below.

import type { RawParams, StateRule } from '@uirouter/core';

import type { RedirectStatusCode } from './redirects.ts';
import { createRouterPool } from './router-pool.ts';
import type { PooledRouter, RouterPool } from './router-pool.ts';
import {
  markedVerdict,
  notFoundVerdict,
  otherwiseVerdict,
  redirectVerdict,
  respelledVerdict,
  shellVerdict,
  toTarget,
} from './server-router.ts';
import type {
  DelegateVerdict,
  Mount,
  ResponseVerdict,
  SimulateTier,
  Verdict,
} from './server-router.ts';
import { onOrigin } from './trailing-slash.ts';

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const SETTLE_TIMEOUT_MS = 100;

type SimulateModule = typeof import('./simulate.ts');

const buildHeadlessRouter = (simulate: SimulateModule, mount: Mount) => {
  const router = simulate.createHeadlessRouter(
    mount.config.routes,
    mount.config.config,
  );

  // The real rule, replayed: otherwise() only fires when no other rule
  // matches, and the url-less target leaves the memory location unmoved.
  if (mount.config.otherwise) {
    const state = mount.config.otherwise.state;
    router.urlService.rules.otherwise(() => ({ state }));
  }

  for (const rule of mount.config.redirects ?? []) {
    const to = toTarget(rule.to);

    if (rule.pattern instanceof RegExp) {
      router.urlService.rules.when(rule.pattern, () => ({
        state: to.state,
        params: to.params,
      }));
    } else {
      router.urlService.rules.when(rule.pattern, (params: RawParams) => ({
        state: to.state,
        params: { ...params, ...to.params },
      }));
    }
  }

  return router;
};

const prewarmPools = (
  simulate: SimulateModule,
  mounts: Mount[],
  poolOf: (mount: Mount) => RouterPool,
): void => {
  for (const mount of mounts) {
    try {
      poolOf(mount).warm(
        () => buildHeadlessRouter(simulate, mount),
        mount.prewarm,
      );
    } catch {
      // That mount's requests build on demand, as an unwarmed pool's do.
    }
  }
};

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const settledWithinTimeout = (settled: Promise<boolean>): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    settled,
    new Promise<false>((expire) => {
      timer = setTimeout(() => expire(false), SETTLE_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
};

// The state a url rule belongs to, when it is a state's own url rule.
const ruleState = (rule: { type: string }): string | undefined =>
  // SAFETY: core tags a state's url rule 'STATE', and only StateRule carries that tag.
  rule.type === 'STATE' ? (rule as StateRule).state.name : undefined;

// The url's own state's redirect status, as the matcher reads it; a pattern rule's match has none.
const matchedStatus = (
  router: PooledRouter['router'],
  subpath: string,
): RedirectStatusCode | undefined => {
  const matched = router.urlService.match({
    path: subpath,
    search: {},
    hash: '',
  });

  // SAFETY: core tags a state's url rule 'STATE', and only StateRule carries that tag.
  return matched?.rule.type === 'STATE'
    ? (matched.rule as StateRule).state.self.redirectStatusCode
    : undefined;
};

// Verdicts decided by url matching alone; a marked state never transitions here, so its resolves never block the verdict.
const matchedVerdict = (
  router: PooledRouter['router'],
  mount: Mount,
  subpath: string,
): Verdict | null => {
  const matched = router.urlService.match({
    path: subpath,
    search: {},
    hash: '',
  });

  if (!matched) return notFoundVerdict(mount);
  const state = ruleState(matched.rule);

  if (state === undefined) return null;

  // SAFETY: a StateRule's match is its url matcher's RawParams.
  const params = matched.match as RawParams;

  return markedVerdict(mount, subpath, { state, params });
};

// Null when the transition failed or timed out: that router may still be mid-transition.
const replayVerdict = async (
  pooled: PooledRouter,
  mount: Mount,
  subpath: string,
): Promise<Verdict | null> => {
  const { router } = pooled;
  const decided = matchedVerdict(router, mount, subpath);

  if (decided?.kind === 'response' || decided?.kind === 'delegate')
    return respelledVerdict(mount, subpath, decided.state) ?? decided;

  if (decided !== null) return decided;
  const settled = pooled.nextSettled();
  router.urlService.url(subpath);
  router.urlService.sync();

  if (!(await settledWithinTimeout(settled))) return null;

  // A transition that settled on the otherwise state IS the 404 page.
  if (router.globals.current.name === mount.config.otherwise?.state)
    return otherwiseVerdict(mount);
  // The memory location only moves when the client's address bar would:
  // core skips the url push for url-sourced transitions.
  const landed = onOrigin(router.urlService.url());

  return landed === subpath
    ? (respelledVerdict(mount, subpath, router.globals.$current.name) ??
        shellVerdict(mount))
    : redirectVerdict(mount, landed, matchedStatus(router, subpath));
};

const simulateVerdict = async (
  simulate: SimulateModule,
  pool: RouterPool,
  mount: Mount,
  subpath: string,
): Promise<Verdict> => {
  try {
    const pooled = pool.checkOut(() => buildHeadlessRouter(simulate, mount));

    const verdict = await replayVerdict(pooled, mount, subpath);

    // Failed and timed-out transitions degrade to the shell — the client
    // router re-runs them with its full configuration; never a wrong redirect.
    // Their router is dropped, never pooled.
    if (verdict === null) return shellVerdict(mount);
    pooled.release();

    return verdict;
  } catch {
    // Core can throw synchronously (registration, matching, sync); degrade
    // to the shell — the client router re-runs the url with its full
    // configuration — never a wrong redirect or a spurious 404.
    return shellVerdict(mount);
  }
};

// Url matching only: the router is checked out, matched against and released without a transition.
const simulateMarked = (
  simulate: SimulateModule,
  pool: RouterPool,
  mount: Mount,
  subpath: string,
): DelegateVerdict | ResponseVerdict | null => {
  try {
    const pooled = pool.checkOut(() => buildHeadlessRouter(simulate, mount));

    const verdict = matchedVerdict(pooled.router, mount, subpath);
    pooled.release();

    return verdict?.kind === 'delegate' || verdict?.kind === 'response'
      ? verdict
      : null;
  } catch {
    // The navigation path degrades the same throw to the shell.
    return null;
  }
};

/**
 * The simulate tier for one router. Its first use starts the dynamic import of
 * `./simulate.ts`, so a matcher-only config never loads @uirouter/core.
 */
export const createSimulateTier = (): SimulateTier => {
  let loaded: Promise<SimulateModule> | null = null;

  const load = (): Promise<SimulateModule> =>
    (loaded ??= import('./simulate.ts'));

  // One pool per mount, made on its first use.
  const pools = new WeakMap<Mount, RouterPool>();

  const poolOf = (mount: Mount): RouterPool => {
    let pool = pools.get(mount);

    if (!pool) pools.set(mount, (pool = createRouterPool()));

    return pool;
  };

  return {
    // Paid at construction, not on the first request. Prewarm chains first,
    // so it fills the pools before any request's check-out. The stray
    // rejection is silenced here; a request awaits the same cached promise and
    // rethrows.
    start(mounts) {
      void load()
        .then((simulate) => prewarmPools(simulate, mounts, poolOf))
        .catch(() => {});
    },
    verdict: async (mount, subpath) =>
      simulateVerdict(await load(), poolOf(mount), mount, subpath),
    marked: async (mount, subpath) =>
      simulateMarked(await load(), poolOf(mount), mount, subpath),
  };
};
