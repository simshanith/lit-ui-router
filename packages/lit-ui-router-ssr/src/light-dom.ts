// The client half of a consumer's light-DOM element: asleep under `defer-hydration`, then adopted in place.
import { noChange } from 'lit';
import type { LitElement, PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { requestContext } from 'lit-ui-router/context';

import { adoptUiViewContext } from './adopt-context.js';
import type { AdoptableView } from './adopt-context.js';
import { lightDomBrand } from './light-dom-brand.js';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

/**
 * A light-DOM element that owns its side of a server render.
 */
export interface LightDomHydratingElement extends LitElement {
  /**
   * Written by the server on a prerendered element; while it is present the
   * element renders nothing, and removing it wakes and hydrates the element.
   */
  deferHydration: boolean;
  /**
   * Answers the use site's `renderLight()` part with `noChange`, so the render
   * that reaches it leaves this element's own nodes where they stand.
   */
  renderLight(): typeof noChange;
}

/** A `LitElement` subclass, in the form TypeScript accepts as a mixin's base. */
// oxlint-disable-next-line typescript/no-explicit-any -- TypeScript treats a construct signature as a mixin only with a lone `any[]` rest parameter
export type LitElementConstructor = new (...args: any[]) => LitElement;

/** The class {@link LightDomHydrating} produces: `Base`, branded. */
export interface LightDomHydratingConstructor {
  /** Builds one element; a parsed element is upgraded with no arguments. */
  // oxlint-disable-next-line typescript/no-explicit-any -- TypeScript treats a construct signature as a mixin only with a lone `any[]` rest parameter
  new (...args: any[]): LightDomHydratingElement;
  /** Identifies this class as light-DOM hydrating across package copies. */
  readonly [lightDomBrand]: true;
}

/**
 * Adds the light-DOM side of a server render to a consumer's `LitElement`.
 *
 * The element renders into its own light DOM. It sleeps while
 * `defer-hydration` is on it and holds the nodes the server drew; removing the
 * attribute wakes it, and its first update requests the adopter `hydrateRoot()`
 * provides and calls it, which hydrates the element's `render()` against those
 * nodes in place. With no adopter it renders cold.
 *
 * `LightElementRenderer` from `lit-ui-router-ssr` is the server half: it
 * matches a class this produced. The use site writes `${renderLight()}` inside
 * the element.
 *
 * @param Base - the consumer's `LitElement` class
 * @returns the class, branded
 *
 * @example
 * ```ts
 * import { LitElement, html } from 'lit';
 * import { LightDomHydrating } from 'lit-ui-router-ssr/client';
 *
 * class AppCard extends LightDomHydrating(LitElement) {
 *   render() {
 *     return html`<p>card</p>`;
 *   }
 * }
 * ```
 */
export const LightDomHydrating = <T extends LitElementConstructor>(
  Base: T,
): T & LightDomHydratingConstructor => {
  class LightDomHydratingClass extends Base {
    static readonly [lightDomBrand] = true as const;

    /** @internal */
    @property({ type: Boolean, attribute: DEFER })
    deferHydration = false;

    /** Set at connect on a deferred element, so the first update that runs is known to be the wake. */
    private deferredAtConnect = false;

    // TODO(#904 research): forcing light DOM here, versus requiring the consumer's own createRenderRoot.
    /** @internal */
    protected override createRenderRoot(): HTMLElement {
      return this;
    }

    /** @internal */
    override connectedCallback(): void {
      super.connectedCallback();

      // TODO(#904 research): a top-level light element gets no `defer-hydration` from @lit-labs/ssr, so it wakes on connect and renders over the served nodes.
      if (this.deferHydration) {
        this.deferredAtConnect = true;
      } else if (this.deferredAtConnect) {
        this.requestUpdate();
      }
    }

    /** @internal */
    protected override shouldUpdate(changed: PropertyValues): boolean {
      if (this.deferHydration) return false;

      // Detached before the wake ran: the held nodes and the wake survive until a re-attach.
      if (this.deferredAtConnect && !this.isConnected) return false;

      return super.shouldUpdate(changed);
    }

    /** @internal */
    protected override willUpdate(changed: PropertyValues): void {
      if (this.deferredAtConnect) this.adoptHeldNodes();

      super.willUpdate(changed);
    }

    /** The wake: hand the element to the adopter, which hydrates `render()` in place; the update that follows commits onto the adopted part. */
    private adoptHeldNodes(): void {
      this.deferredAtConnect = false;
      const adopt = requestContext(this, adoptUiViewContext);

      // TODO(#904 research): the adopter reports `ui-view:adopt` from this element and reveals nested light elements' interiors with its own; a light-element outcome may want its own event.
      if (!adopt) {
        // TODO(#904 research): drop the held render as served-view.ts's `dropHeldRender` does; sharing it means touching served-view.ts.
        return;
      }

      // SAFETY: `render()` is protected on LitElement; the adopter calls it the way LitElement's own update does.
      adopt(this as this & AdoptableView);
    }

    /** @internal */
    renderLight(): typeof noChange {
      return noChange;
    }
  }

  return LightDomHydratingClass;
};
