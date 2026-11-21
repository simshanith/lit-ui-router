// Type-only core import: ui-router-server's matcher-only configs must never load @uirouter/core.
import type { UIRouter } from '@uirouter/core';

/**
 * Restores the globals the UIRouter constructor leaves and deactivates every
 * view, so the next transition starts from the root as a fresh load does: no
 * state is retained, and no resolve or view carries over from where the
 * router stood.
 *
 * @param router - a router with no transition in flight
 */
export const resetRouter = (router: UIRouter): void => {
  const { globals, stateRegistry, viewService } = router;
  globals.transitionHistory.clear();
  globals.successfulTransitions.clear();
  globals.$current = stateRegistry.root();
  globals.current = globals.$current.self;

  for (const key of Object.keys(globals.params)) delete globals.params[key];

  // `_pluginapi` is core's `@internal` API; a copy, as deactivating splices the live list.
  for (const config of [...viewService._pluginapi._activeViewConfigs()])
    viewService.deactivateViewConfig(config);
  viewService.sync();
};
