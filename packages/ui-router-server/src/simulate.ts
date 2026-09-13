import { servicesPlugin, UIRouter } from '@uirouter/core';
import type { StateDeclaration } from '@uirouter/core';

import { serverLocationPlugin } from './location.ts';

/**
 * Core's own headless recipe: vanilla $q/$injector plus an in-memory location
 * need no DOM, so per-request instantiation is workerd-safe.
 *
 * Callers must pass FRESH declaration objects on every call: core mutates
 * registrations ($$state), so sharing declarations across routers breaks
 * concurrent use.
 */
export function createHeadlessRouter(states: StateDeclaration[]): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  // Path-shaped, not hash-shaped: a headless router builds the hrefs a
  // pushState client would.
  router.plugin(serverLocationPlugin);
  // Callers observe outcomes through onceSettled; keep the console quiet.
  router.stateService.defaultErrorHandler(() => {});
  states.forEach((state) => router.stateRegistry.register(state));
  return router;
}

/**
 * Resolves once the router's transition settles — true on success, false on a
 * real failure. Redirected rejections only hand off to a successor
 * transition, so the final transition's outcome is the answer.
 */
export function onceSettled(router: UIRouter): Promise<boolean> {
  return new Promise((resolve) => {
    router.transitionService.onSuccess({}, () => resolve(true));
    router.transitionService.onError({}, (transition) => {
      if (!transition.error().redirected) resolve(false);
    });
  });
}
