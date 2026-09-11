import type { StateOrName, UIRouter } from '@uirouter/core';
import type { DSRPlugin } from '@uirouter/dsr';

/** the plugin's own `name`, which is how `getPlugin` addresses it */
const DSR_PLUGIN = 'deep-state-redirect';

/**
 * Forgets a recorded deep state once the work it held is finished.
 *
 * DSR remembers the deepest previously-active child of a sticky branch, and a
 * state the user is *done* with should stop being that memory. Saving or
 * sending a draft from OUTSIDE `mymessages` is the case that needs it: the
 * return trip lands on the other branch, so `mymessages.messagelist` is never
 * activated and `mymessages.compose` stays the recorded child — the next click
 * on Messages reopens the finished draft.
 *
 * Scoped by `finished` so it only forgets that one state. Coming back from a
 * draft saved from WITHIN the branch re-records the message the user was
 * reading, and resetting unconditionally would throw that away too.
 */
export function dsrForgetFinishedState(
  router: UIRouter,
  dsrState: StateOrName,
  finished: string,
): void {
  const dsr = router.getPlugin(DSR_PLUGIN) as DSRPlugin | undefined;
  // getRedirect falls back to the configured default, so it is never empty
  if (dsr?.getRedirect(dsrState)?.name() === finished) {
    dsr.reset(dsrState);
  }
}

export default dsrForgetFinishedState;
