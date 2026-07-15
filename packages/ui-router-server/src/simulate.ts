import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { StateDeclaration } from '@uirouter/core';

// Core's own headless recipe: vanilla $q/$injector plus an in-memory location
// need no DOM, so per-request instantiation is workerd-safe.
//
// Callers must pass FRESH declaration objects on every call: core mutates
// registrations ($$state), so sharing declarations across routers breaks
// concurrent use.
export function createHeadlessRouter(states: StateDeclaration[]): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  // Callers observe outcomes through onceSettled; keep the console quiet.
  router.stateService.defaultErrorHandler(() => {});
  states.forEach((state) => router.stateRegistry.register(state));
  return router;
}

// Redirected rejections only hand off to a successor transition, so the final
// transition's outcome is the answer.
export function onceSettled(router: UIRouter): Promise<boolean> {
  return new Promise((resolve) => {
    router.transitionService.onSuccess({}, () => resolve(true));
    router.transitionService.onError({}, (transition) => {
      if (!transition.error().redirected) resolve(false);
    });
  });
}
