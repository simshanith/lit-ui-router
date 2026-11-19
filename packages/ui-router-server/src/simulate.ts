import { servicesPlugin, UIRouter } from '@uirouter/core';
import type { StateDeclaration } from '@uirouter/core';

import { serverLocationPlugin } from './location.ts';
import type { UrlPatternCompiler } from './redirects.ts';
import { applyUrlConfig } from './url-config.ts';
import type { RouterUrlConfig } from './url-config.ts';

/** Options for {@link createHeadlessRouter}, beside the url config. */
export interface HeadlessRouterOptions {
  /**
   * The compiler for {@link url-pattern!urlPattern | urlPattern} urls:
   * {@link url-pattern/server!urlPatternCompiler | `urlPatternCompiler`}.
   */
  urlPattern?: Pick<UrlPatternCompiler, 'plugin'>;
}

/**
 * Core's own headless recipe: vanilla $q/$injector plus an in-memory location
 * need no DOM, so per-request instantiation is workerd-safe.
 *
 * Registers a shallow copy of each declaration, so one array can back many
 * concurrent routers. Inside a declaration's own functions (`redirectTo`,
 * resolves, hooks), `transition.to()` and `state.self` are the copy, not the
 * caller's object; compare states by `name`.
 *
 * States with {@link url-pattern!urlPattern | urlPattern} urls need
 * `options.urlPattern`, whose plugin is applied before they register.
 */
export function createHeadlessRouter(
  states: readonly StateDeclaration[],
  config?: RouterUrlConfig,
  options: HeadlessRouterOptions = {},
): UIRouter {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(serverLocationPlugin);
  applyUrlConfig(router, config);

  if (options.urlPattern) router.plugin(options.urlPattern.plugin);
  // Callers observe outcomes through onceSettled; keep the console quiet.
  router.stateService.defaultErrorHandler(() => {});
  // Core stamps $$state on the object it registers; a shared declaration would point at the last router's StateObject.
  states.forEach((state) => router.stateRegistry.register({ ...state }));

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
