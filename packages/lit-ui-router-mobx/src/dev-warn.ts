import { UIRouterLitElement } from 'lit-ui-router';

/**
 * Whether lit resolved to its development build. `enableWarning` is inherited
 * from `ReactiveElement`, which declares it optional precisely because it
 * exists only in development — lit's own docs prescribe guarding on it. Same
 * shape in lit 2 and 3, and typed optional in both builds' `.d.ts`, so this
 * needs no cast. Read per call, so import order cannot matter.
 *
 * A local copy of lit-ui-router's helper, which is `@internal` and so not a
 * cross-package import.
 *
 * @internal
 */
export function inLitDevMode(): boolean {
  return typeof UIRouterLitElement.enableWarning === 'function';
}

/**
 * Hosts already told about a missing `<ui-router>`. One registry for the whole
 * package, not one per controller: a host wired to several controllers has a
 * single missing provider, and a wall of near-identical messages obscures the
 * one fix.
 *
 * @internal
 */
const warnedMissingRouter = new WeakSet<Element>();

/**
 * Warns once per element that a controller found no `<ui-router>` ancestor and
 * has therefore degraded to a no-op.
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
