import { UIRouterLitElement } from 'lit-ui-router';

// Copy of lit-ui-router's @internal helper; enableWarning exists only in lit's dev build.
/** @internal */
export function inLitDevMode(): boolean {
  return typeof UIRouterLitElement.enableWarning === 'function';
}

// Package-wide, not per controller: a host with several controllers has one missing provider.
const warnedMissingRouter = new WeakSet<Element>();

/**
 * Warns once per element that a controller found no `<ui-router>` ancestor.
 *
 * @param element the host whose controller found nothing
 * @param subject how to name it in the message, e.g. `RouterReactionController`
 * @param consequence what will not happen, e.g. `will not observe the router`
 *
 * @internal
 */
export function warnMissingRouter(
  element: Element,
  subject: string,
  consequence: string,
): void {
  // DEV folds away in dist/*.js (check:dev-split); inLitDevMode() is the runtime probe.
  if (!import.meta.env.DEV) return;
  if (!inLitDevMode() || warnedMissingRouter.has(element)) {
    return;
  }
  warnedMissingRouter.add(element);
  console.warn(
    `lit-ui-router-mobx: ${subject} found no <ui-router> ancestor, so it ${consequence}. ` +
      'Wrap this subtree in <ui-router>, or pass a router explicitly.',
    element,
  );
}
