// The key a waking served view asks on, and the shape an adopter sees it as.
import type { RenderOptions } from 'lit';
import type { Context } from 'lit-ui-router/context';

/**
 * The identity of {@link adoptUiViewContext}: a plain object, so the key is
 * unique under `===` and readable in a debugger.
 *
 * @category client
 */
export interface AdoptUiViewContextKey {
  /** Names the key for a debugger; identity, not this string, is what matches. */
  readonly name: 'lit-ui-router-ssr/context#adopt-ui-view';
}

/**
 * The waking `<ui-view>` as an adopter sees it: the element holding the served
 * nodes, with the template and render options a hydrate reads.
 *
 * @category client
 */
export interface AdoptableView extends HTMLElement {
  /** The routed template the served nodes came from. */
  render(): unknown;
  /** The options the view renders with, which the hydrate reads too. */
  readonly renderOptions: RenderOptions;
}

/**
 * The adopt-view context key's type — {@link AdoptUiViewContextKey} branded
 * with the adopter function, so `@consume({ context: adoptUiViewContext })`
 * infers it.
 *
 * @category client
 */
export type AdoptUiViewContext = Context<
  AdoptUiViewContextKey,
  (view: AdoptableView) => void
>;

/**
 * The context key a hydration client answers for, under the container it
 * hydrates, with the function that adopts a waking `<ui-view>`'s held nodes.
 *
 * The view requests it once on its waking update, after re-seeking its router,
 * and calls what it gets. Unanswered, the view drops the held nodes and warns.
 *
 * {@link hydrateRoot} provides it with core's `provideContext()`; an element
 * provides it with `@provide` from `@lit/context`, since the key is the one
 * `createContext()` would have produced.
 *
 * @example
 * ```ts
 * import { provideContext } from 'lit-ui-router/context';
 * import { adoptUiViewContext } from 'lit-ui-router-ssr/client';
 *
 * const uninstall = provideContext(container, adoptUiViewContext, (view) =>
 *   adopt(view),
 * );
 * ```
 *
 * @category client
 */
export const adoptUiViewContext: AdoptUiViewContext = Object.freeze({
  name: 'lit-ui-router-ssr/context#adopt-ui-view',
}) as AdoptUiViewContext;
