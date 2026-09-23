// The served variant of `<ui-view>`: the class `lit-ui-router-ssr/register` defines the tag with.
import { noChange } from 'lit';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { requestContext } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';

import { adoptUiViewContext } from './adopt-context.js';
import {
  warnDeferredNeverWoken,
  warnDeferredWithoutClient,
} from './dev-warn.js';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

/** Spelled out because the @lit-labs/ssr DOM shim has no `Node`. */
const COMMENT_NODE = 8 satisfies Node['COMMENT_NODE'];

/**
 * Whether `node` opens a render's output: lit's own empty child-part comment,
 * or a part marker a render wrote under whatever prefix.
 */
const isRenderMarker = (node: ChildNode | null): boolean => {
  if (!node || node.nodeType !== COMMENT_NODE) return false;
  const { data } = node as Comment;
  return data === '' || data.includes('lit-part');
};

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
   * Written by the server on a prerendered view; while it is present the view
   * renders nothing, and removing it wakes and hydrates the element.
   */
  deferHydration: boolean;
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
 * `ui-view` tag map entry still describes it.
 *
 * What it adds is the element's half of a prerendered page. The view sleeps
 * while `defer-hydration` is on it, rendering nothing and holding the nodes the
 * server drew. Removing the attribute wakes it: it re-seeks its router, so the
 * render it is about to make reads the settled registration, then requests
 * {@link adoptUiViewContext} once and calls the adopter it gets. With none, it
 * drops the held render and renders cold, warning in development. A view
 * detached before that wake update runs stays asleep, holding its nodes, until
 * it is attached again. Whatever the author wrote ahead of the held render is
 * the view's fallback set, taken at the wake and left standing where it is.
 * `renderLight()` answers the {@link uiViewSlot} part with `noChange`.
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
    @property({ type: Boolean, attribute: DEFER })
    deferHydration = false;

    /** Set at connect on a deferred view, so the first update that runs is known to be the wake. */
    private deferredAtConnect = false;

    /** @internal */
    override connectedCallback(): void {
      super.connectedCallback();
      // A deferred view holds a render's nodes behind whatever the author wrote ahead of them.
      if (this.deferHydration) {
        this.deferredAtConnect = true;
        if (import.meta.env.DEV) {
          // A macrotask: the hydrate walk clears the attribute within this task, and a pin answers on the wake update queued inside it.
          setTimeout(() => {
            if (this.isConnected && this.deferHydration && !this.hasUpdated) {
              warnDeferredNeverWoken(this);
            }
          }, 0);
        }
      } else if (this.deferredAtConnect) {
        // Re-attached still asleep: the wake update is this element's to ask for, since a router-less view registers nothing that would.
        this.requestUpdate();
      }
    }

    /**
     * Declines the connect-time capture while this view holds a server render.
     *
     * A deferred view is a parsed one, and the document parser can connect an
     * element before it fills it, so the capture is the wake's.
     *
     * @internal
     */
    protected override captureContent(): void {
      if (this.deferHydration || this.deferredAtConnect) return;
      super.captureContent();
    }

    /**
     * Declines every update while the view sleeps.
     *
     * A declined update still settles: `updateComplete` resolves `true` while
     * the view is asleep, so awaiting it proves nothing about a render having
     * happened — `hasUpdated` tells the two states apart. lit also marks the
     * declined update complete, so the changed-properties map arrives empty at
     * the wake and carries nothing that changed during a detached sleep.
     *
     * @internal
     */
    protected override shouldUpdate(changed: PropertyValues<this>): boolean {
      // Asleep: nothing renders, and `hasUpdated` stays false, so `firstUpdated` still fires on the real first render.
      if (this.deferHydration) return false;
      // Detached before the wake ran: `willUpdate` is skipped too, so the held nodes and the wake survive until a re-attach.
      if (this.deferredAtConnect && !this.isConnected) return false;
      return super.shouldUpdate(changed);
    }

    /** @internal */
    protected override willUpdate(changed: PropertyValues<this>): void {
      if (this.deferredAtConnect) {
        this.adoptHeldNodes();
        // The wake is this view's first look at its children.
        this.captureContentInPlace();
      }
      super.willUpdate(changed);
    }

    /** The first attached update after a wake: re-seek the router the hydrate reads, then hand the view to an adopter or drop the foreign nodes. */
    private adoptHeldNodes(): void {
      this.deferredAtConnect = false;
      this.adoptProvidedRouter();
      const adopt = requestContext(this, adoptUiViewContext);
      if (adopt) return adopt(this);
      // Rendering over a render's nodes doubles the markup; what the author wrote ahead of them is the capture's.
      this.dropHeldRender();
      warnDeferredWithoutClient(this);
    }

    /** Drops the held render: every child from the first render marker down, leaving what the author wrote ahead of it. */
    private dropHeldRender(): void {
      const children = [...this.childNodes];
      const from = children.findIndex((child) => isRenderMarker(child));
      if (from < 0) return;
      // Optionally called: the @lit-labs/ssr DOM shim gives its nodes no `remove`.
      for (const child of children.slice(from)) child.remove?.();
    }

    /** @internal */
    renderLight(): typeof noChange {
      return noChange;
    }
  }
  return ServedView;
};
