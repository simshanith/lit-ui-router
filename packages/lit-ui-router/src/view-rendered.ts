import type { ActiveUIView, Transition, UIRouter } from '@uirouter/core';
import type { ReactiveElement } from 'lit';

type Updating = Element &
  Partial<Pick<ReactiveElement, 'isUpdatePending' | 'updateComplete'>>;

/** The slice of a `<ui-view>` that {@link viewRendered} awaits. */
interface ViewHost extends ReactiveElement {
  readonly routedElement: Updating | null;
}

const viewHosts = new WeakMap<ActiveUIView, ViewHost>();

/**
 * Records the element behind a view registration, so {@link viewRendered}
 * can await it.
 *
 * Not re-exported by `pure.ts`: `<ui-view>` calls it as it registers.
 *
 * @internal
 */
export function setViewHost(view: ActiveUIView, host: ViewHost): void {
  viewHosts.set(view, host);
}

const noop = () => {};

/** The view hosts, and their routed elements, with an update queued. */
function pendingUpdates(router: UIRouter): PromiseLike<unknown>[] {
  const pending: PromiseLike<unknown>[] = [];

  for (const view of router.viewService._pluginapi._registeredUIViews()) {
    const host = viewHosts.get(view);

    if (!host) continue;

    if (host.isUpdatePending) {
      pending.push(host.updateComplete);
    }

    const element = host.routedElement;

    if (element?.isUpdatePending && element.updateComplete) {
      pending.push(element.updateComplete);
    }
  }

  return pending;
}

/**
 * Resolves once the routed views have rendered `transition`.
 *
 * `onSuccess` hooks and `transition.promise` settle when the transition
 * succeeded; each `<ui-view>` swaps its component in a Lit update after that,
 * and the element it rendered updates after the view does. This waits for
 * every `<ui-view>` registered with `router`, and its
 * {@link UiView.routedElement | routedElement}, to complete its update, then
 * repeats until none has an update queued: that covers the views those
 * updates connected, and the view's update that retires the element a swap
 * replaced, so the outgoing element is gone when this resolves.
 *
 * It resolves on `updateComplete`, never on an animation frame, so it is safe
 * to await while a View Transition snapshot is held.
 *
 * A transition that fails or is superseded renders nothing of its own: the
 * promise resolves once the views have settled, and `transition.promise`
 * still carries the outcome. A transition started in its place, such as a
 * redirect from an `onError` hook, is not followed; await that transition
 * with its own call.
 *
 * @param router - The router the `<ui-view>`s registered with.
 * @param transition - The transition to wait for; defaults to the one in
 * flight, else the last successful one.
 *
 * @example Move focus once the new view is in the DOM
 * ```ts
 * import { viewRendered } from 'lit-ui-router';
 *
 * router.transitionService.onSuccess({}, async (trans) => {
 *   await viewRendered(router, trans);
 *   document.querySelector<HTMLElement>('main h1')?.focus();
 * });
 * ```
 *
 * @example Show an error view, and wait for it to render
 * ```ts
 * router.transitionService.onError({}, async () => {
 *   const redirect = router.stateService.go('error');
 *   await viewRendered(router, redirect.transition);
 *   document.querySelector<HTMLElement>('main h1')?.focus();
 * });
 * ```
 *
 * @example Release a View Transition
 * ```ts
 * router.transitionService.onStart({}, (trans) => {
 *   if (!document.startViewTransition) return;
 *   let captured!: () => void;
 *   const oldViewCaptured = new Promise<void>((resolve) => (captured = resolve));
 *   document.startViewTransition(() => {
 *     captured();
 *     return viewRendered(router, trans);
 *   });
 *   return oldViewCaptured;
 * });
 * ```
 *
 * @category core
 */
export async function viewRendered(
  router: UIRouter,
  transition: Transition | undefined = router.globals.transition ??
    router.globals.successfulTransitions.peekTail(),
): Promise<void> {
  await transition?.promise.then(noop, noop);

  for (
    let pending = pendingUpdates(router);
    pending.length;
    pending = pendingUpdates(router)
  ) {
    await Promise.all(pending);
  }
}
