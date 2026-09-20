// The served variant of `<ui-view>`: the class `lit-ui-router-ssr/register` defines the tag with.
import { noChange } from 'lit';
import { UiView } from 'lit-ui-router/pure';

/**
 * Brands the served class, so a second copy of this package recognises the one
 * already registered. `customElements` identity cannot: two copies build two
 * classes.
 *
 * @category client
 */
export const servedViewBrand: unique symbol = Symbol.for(
  'lit-ui-router-ssr#served-view',
);

/**
 * A `<ui-view>` that owns its side of a server render.
 *
 * @category client
 */
export interface ServedUiView extends UiView {
  /**
   * Answers the {@link uiViewSlot} part with `noChange`, so the render that
   * reaches it leaves this view's own nodes where they stand.
   */
  renderLight(): typeof noChange;
}

/**
 * The class {@link withServedRender} produces: a `<ui-view>` constructor,
 * branded.
 *
 * @category client
 */
export interface ServedUiViewConstructor {
  /** Builds one served view; the element takes no constructor arguments. */
  new (): ServedUiView;
  /** Identifies this class as a served `<ui-view>` across package copies. */
  readonly [servedViewBrand]: true;
}

/**
 * Whether `constructor` is a served `<ui-view>` class — this package's, or
 * another copy's.
 *
 * @param constructor - the class a registry holds for a tag
 *
 * @category client
 */
export const isServedViewClass = (
  constructor: CustomElementConstructor | undefined,
): boolean =>
  !!constructor &&
  (constructor as Partial<ServedUiViewConstructor>)[servedViewBrand] === true;

/**
 * Adds the served-render side of `<ui-view>` to `Base`.
 *
 * The result is still a `<ui-view>`: it extends the class it is given, so
 * `instanceof UiView` holds, an enclosing view adopts it as a parent, and the
 * `ui-view` tag map entry still describes it. What it adds is the element's
 * half of a prerendered page — `renderLight()`, which answers the
 * {@link uiViewSlot} part the server filled with `noChange`.
 *
 * `lit-ui-router-ssr/register` applies it to core's `UiView` and defines the
 * `ui-view` tag with the result. Apply it by hand to put a served view under a
 * tag of your own, alongside `lit-ui-router/pure`, which registers nothing.
 *
 * @param Base - core's `UiView`
 * @returns the served class, branded
 *
 * @example
 * ```ts
 * import { UiView } from 'lit-ui-router/pure';
 * import { withServedRender } from 'lit-ui-router-ssr/client';
 *
 * customElements.define('app-view', withServedRender(UiView));
 * ```
 *
 * @category client
 */
export const withServedRender = (
  Base: typeof UiView,
): ServedUiViewConstructor & typeof UiView => {
  class ServedView extends Base {
    static readonly [servedViewBrand] = true as const;

    /** @internal */
    renderLight(): typeof noChange {
      return noChange;
    }
  }
  return ServedView;
};
