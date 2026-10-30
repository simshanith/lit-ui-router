// The development-only warnings served elements raise; folded out of dist/*.js by check:dev-split.

import { devGate } from '#dev-gate';

/**
 * Warns that a `<ui-view>` woke from `defer-hydration` with nothing answering
 * its adopter request, so it dropped the nodes it held and rendered cold.
 *
 * Fires at the wake, which happens once per element, so this needs no registry
 * of its own.
 *
 * @param element - the view whose held nodes were dropped
 *
 * @internal
 */
export function warnDeferredWithoutClient(element: Element): void {
  // DEV folds the whole body out of dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;
  console.warn(
    'lit-ui-router-ssr: this <ui-view> woke from defer-hydration and nothing answered its adoptUiViewContext request, so its held nodes were dropped and it rendered cold. Provide an adopter before the wake.',
    element,
  );
}

/**
 * Warns that a light-DOM hydrating element woke from `defer-hydration` with
 * nothing answering its adopter request, so it dropped the nodes it held and
 * rendered cold.
 *
 * @param element - the element whose held nodes were dropped
 *
 * @internal
 */
export function warnLightWithoutClient(element: Element): void {
  // DEV folds the whole body out of dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;
  console.warn(
    'lit-ui-router-ssr: this light-DOM element woke from defer-hydration and nothing answered its adoptUiViewContext request, so its held nodes were dropped and it rendered cold. Hydrate the page with hydrateRoot() or bootstrap() from lit-ui-router-ssr/client.',
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
 * @param element - the view that stayed asleep
 *
 * @internal
 */
export function warnDeferredNeverWoken(element: Element): void {
  // DEV folds the whole body out of dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;

  if (warnedNeverWoken.has(element)) return;
  warnedNeverWoken.add(element);
  console.warn(
    'lit-ui-router-ssr: this <ui-view> is still asleep after the task it connected in, because nothing removed defer-hydration. ' +
      'It renders nothing and holds the served markup as it stands. ' +
      'Usual causes: a clone of a served view, which copies the attribute but not the hydrate walk that clears it, ' +
      'and a document whose hydrate walk threw before reaching this view or never ran. ' +
      'Hydrate the document, or remove defer-hydration from the clone.',
    element,
  );
}
