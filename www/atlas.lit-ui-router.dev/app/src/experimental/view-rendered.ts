/**
 * EXPERIMENTAL — "the view has re-rendered", reconstructed.
 *
 * ui-router has no hook for it: `onSuccess` and `transition.promise` settle
 * when the TRANSITION succeeded, and `<ui-view>` swaps its component in a lit
 * update scheduled after that. `updateComplete` is lit's own promise for that
 * update, so this awaits it on every view host — and then again on the
 * `<atlas-plate>` the new view may have just created, whose own update is
 * one microtask behind. Nothing here waits on an animation frame: under a
 * held View Transition snapshot rendering is suspended and frames never
 * come, which is exactly the trap this module replaces.
 */
import type { ReactiveElement } from 'lit';

const settle = async (selector: string): Promise<void> => {
  const hosts = document.querySelectorAll<ReactiveElement>(selector);
  await Promise.all([...hosts].map((host) => host.updateComplete));
};

/** Resolves once the routed view — and the plate inside it — has rendered. */
export async function viewRendered(): Promise<void> {
  // one microtask, so the requestUpdate() from the success hooks is queued
  await Promise.resolve();
  await settle('ui-view');
  await settle('atlas-plate');
}
