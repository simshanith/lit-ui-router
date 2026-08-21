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
