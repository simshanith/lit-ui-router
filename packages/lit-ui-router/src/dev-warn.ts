import { UIRouterLitElement } from './ui-router.js';

/**
 * Whether lit resolved to its development build. `enableWarning` is inherited
 * from `ReactiveElement`, which declares it optional precisely because it
 * exists only in development — lit's own docs prescribe guarding on it. Same
 * shape in lit 2 and 3, and typed optional in both builds' `.d.ts`, so this
 * needs no cast. Read per call, so import order cannot matter.
 * @internal
 */
export function inLitDevMode(): boolean {
  return typeof UIRouterLitElement.enableWarning === 'function';
}

/**
 * Elements already told about a missing `<ui-router>`. One registry across all
 * the sites, not one per site: a single missing provider trips `uiSref`'s
 * render and its click on the same element, and a wall of near-identical
 * messages obscures the one fix.
 *
 * @internal
 */
const warnedMissingRouter = new WeakSet<Element>();

/**
 * Warns once per element that a binding found no `<ui-router>` ancestor and has
 * therefore degraded to a no-op.
 *
 * Callers must only reach this **after** the router seek has actually run and
 * come back empty. Every seek here is deferred past the element's first render,
 * so a binding legitimately sees no router on its first pass; warning there
 * would fire on every correctly wired app.
 *
 * @param element the element whose binding found nothing
 * @param subject how to name it in the message, e.g. `<a uiSref="home">`
 * @param consequence what will not happen, e.g. `will not navigate`
 *
 * @internal
 */
export function warnMissingRouter(
  element: Element,
  subject: string,
  consequence: string,
): void {
  // DEV folds the whole body out of dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
  if (!import.meta.env.DEV) return;
  if (!inLitDevMode() || warnedMissingRouter.has(element)) {
    return;
  }
  warnedMissingRouter.add(element);
  console.warn(
    `lit-ui-router: ${subject} found no <ui-router> ancestor, so it ${consequence}. ` +
      'Wrap this subtree in <ui-router>, or pass a router explicitly.',
    element,
  );
}

/**
 * Warns that a `<ui-router>` was handed a different `uiRouter` after its first
 * update, which the element does not honour: the views already registered stay
 * on the router they took, and only later connections see the new one.
 *
 * @param element the `<ui-router>` whose property changed
 *
 * @internal
 */
export function warnRouterSwapped(element: Element): void {
  // DEV folds the whole body out of dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
  if (!import.meta.env.DEV) return;
  if (!inLitDevMode()) return;
  console.warn(
    'lit-ui-router: this <ui-router> was given a different uiRouter after its first update. ' +
      'The views already registered stay on the previous router, so the page is split across two. ' +
      'Set uiRouter before the element first updates, or replace the element.',
    element,
  );
}

/**
 * Warns that a `<ui-view>` woke from `defer-hydration` with nothing answering
 * its adopter request, so it dropped the nodes it held and rendered cold.
 *
 * Fires at the wake, which happens once per element, so this needs no registry
 * of its own.
 *
 * @param element the view whose held nodes were dropped
 *
 * @internal
 */
export function warnDeferredWithoutClient(element: Element): void {
  // DEV folds the whole body out of dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
  if (!import.meta.env.DEV) return;
  if (!inLitDevMode()) return;
  console.warn(
    'lit-ui-router: this <ui-view> woke from defer-hydration and nothing answered its adoptUiViewContext request, so its held nodes were dropped and it rendered cold. Provide an adopter before the wake.',
    element,
  );
}

/**
 * Views already told that they never woke. One warning per element: a sleeping
 * view can connect, detach and re-attach, scheduling a check at each connect.
 *
 * @internal
 */
const warnedNeverWoken = new WeakSet<Element>();

/**
 * Warns once per element that a `<ui-view>` is still asleep after the task it
 * connected in, so nothing will ever render into it.
 *
 * Callers must only reach this from a check deferred past the connect task: a
 * hydrate walk clears `defer-hydration` synchronously once the elements have
 * connected, so a view woken the ordinary way is already awake by then.
 *
 * @param element the view that stayed asleep
 *
 * @internal
 */
export function warnDeferredNeverWoken(element: Element): void {
  // DEV folds the whole body out of dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
  if (!import.meta.env.DEV) return;
  if (!inLitDevMode() || warnedNeverWoken.has(element)) return;
  warnedNeverWoken.add(element);
  console.warn(
    'lit-ui-router: this <ui-view> is still asleep after the task it connected in, because nothing removed defer-hydration. ' +
      'It renders nothing and holds the served markup as it stands. ' +
      'Usual causes: a clone of a served view, which copies the attribute but not the hydrate walk that clears it, ' +
      'and a document whose hydrate walk threw before reaching this view or never ran. ' +
      'Hydrate the document, or remove defer-hydration from the clone.',
    element,
  );
}
