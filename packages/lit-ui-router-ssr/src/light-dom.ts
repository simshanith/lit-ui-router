// The client half of a consumer's light-DOM element: asleep under `defer-hydration`, then adopted in place.
import { noChange } from 'lit';
import type { LitElement, PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { requestContext } from 'lit-ui-router/context';

import { adoptUiViewContext } from './adopt-context.js';
import type { AdoptableView } from './adopt-context.js';
import { warnLightWithoutClient } from './dev-warn.js';
import { lightDomBrand } from './light-dom-brand.js';
import { connectServed, dropHeldRender, sleepsThrough } from './served-view.js';

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
   * Answers the use site's `lightSlot()` part with `noChange`, so the
   * render that reaches it leaves this element's own nodes where they stand.
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
 * The element renders into its own light DOM, and `static styles` do not apply
 * to it: there is no shadow root to adopt them, so it takes the document's
 * styles. It sleeps while `defer-hydration` is on it and holds the nodes the
 * server drew. The use site's `lightSlot()` part removes the attribute when
 * the enclosing walk reaches it, parent first, and pins the adopter to the
 * element. Its first update then requests the adopter and calls it, which
 * hydrates the element's `render()` against those nodes in place and wakes the
 * elements inside it. A hydrate that throws drops the served nodes and renders
 * cold, warning in development; with no adopter at all it does the same.
 *
 * The brand is a static on the class this returns, so subclasses stay opted in
 * and `Base` stays as it was. `LightElementRenderer` from `lit-ui-router-ssr`
 * is the server half: it matches the brand.
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

    /** @internal */
    protected override createRenderRoot(): HTMLElement {
      return this;
    }

    /** @internal */
    override connectedCallback(): void {
      super.connectedCallback();
      this.deferredAtConnect = connectServed(this, this.deferredAtConnect);
    }

    /** @internal */
    protected override shouldUpdate(changed: PropertyValues): boolean {
      if (sleepsThrough(this, this.deferredAtConnect)) return false;

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

      if (!adopt) {
        // Rendering over a render's nodes doubles the markup; what the author wrote ahead of them stays.
        dropHeldRender(this);
        warnLightWithoutClient(this);

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
