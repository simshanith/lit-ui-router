import type { StateDeclaration, UIRouter } from '@uirouter/core';

// .ts extensions: node --test runs this graph directly via type stripping.
import { createHeadlessRouter, onceSettled } from './headless.ts';
import { rootRedirectTarget, routeSegments } from './routes.ts';

// setTimeout exists on every target runtime (worker, node, browser) but not
// in the DOM-free ES lib this package compiles against.
declare function setTimeout(handler: () => void, ms: number): unknown;

// Transitions settle in microtasks; the timer is only a degrade-to-shell net.
const SETTLE_TIMEOUT_MS = 100;

export function createAppRouter(): UIRouter {
  // Fresh declarations per router: core mutates registered declarations
  // ($$state), so sharing them across routers breaks concurrent calls.
  // Dotted names nest, so the flat segment map registers as the real tree.
  const slimStates: StateDeclaration[] = Object.entries(routeSegments).map(
    ([name, url]) => ({ name, url }),
  );
  const router = createHeadlessRouter(slimStates);
  // Mirror router.config.ts: the app root has no state url and is routed by a
  // when(/^\/?$/) rule. Its otherwise() -> notFound rule is NOT mirrored, so
  // unknown paths start no transition and stay worker 404s.
  router.urlService.rules.when(/^\/?$/, () => ({
    state: rootRedirectTarget,
  }));
  return router;
}

/**
 * Replays `path` through a headless router running the app's slim states and
 * returns the path the client app would land on, or null when the address
 * would not change. Unknown paths, errors, and timeouts all return null: the
 * worker degrades to serving the shell (or 404), never a wrong redirect.
 */
export async function computeAppRedirect(path: string): Promise<string | null> {
  try {
    // Fresh router per request: the memory location is per-instance state.
    const router = createAppRouter();
    const url = { path, search: {}, hash: '' };
    if (!router.urlService.match(url)) return null;
    const settled = onceSettled(router);
    router.urlService.url(path);
    router.urlService.sync();
    const outcome = await Promise.race([
      settled,
      new Promise<false>((resolve) =>
        setTimeout(() => resolve(false), SETTLE_TIMEOUT_MS),
      ),
    ]);
    if (!outcome) return null;
    // The memory location only moves when the client's address bar would:
    // core skips the URL push for url-sourced and location:false transitions.
    const landed = router.urlService.url();
    return landed === path ? null : landed;
  } catch {
    return null;
  }
}
