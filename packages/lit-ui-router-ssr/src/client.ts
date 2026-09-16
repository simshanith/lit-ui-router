/**
 * @module
 * @mergeModuleWith <project>
 */
// The adopt half: one `hydrate()` on the root, and the adopter each served `<ui-view>` the walk wakes requests to take its markup.
import { hydrate } from '@lit-labs/ssr-client';
import type { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
import { noChange } from 'lit';
import type { ChildPart, RenderOptions } from 'lit';
import { Directive, directive } from 'lit/directive.js';
import type { PartInfo } from 'lit/directive.js';
import { adoptUiViewContext, provideContext } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';
import { servedMarkerPrefix } from './served-markers.js';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

class UiViewSlotDirective extends Directive {
  /** The flag `@lit-labs/ssr` reads to route this part to `UiViewRenderer.renderLight()`. */
  static _$litRenderLight = true;

  /**
   * Wakes the `<ui-view>` this part sits in, with the adopter pinned to it.
   *
   * A directive is constructed at its part by the walk rendering the enclosing
   * template — the root template for a top-level view, the parent view's own
   * template for a nested one — so the views wake parent first, each one before
   * the walk reads its interior.
   */
  constructor(part: PartInfo) {
    super(part);
    // The marker lit's walk wakes a custom element on is emitted only under a host-stack entry `@lit-labs/ssr` leaks for light-DOM renderers, so the wake is owned here instead.
    const view = (part as ChildPart).parentNode;
    if (!(view instanceof Element)) return;
    // The pin keys off the served pair, not the wake below: where that marker is there, lit's own walk cleared the attribute before this part was reached.
    if (isPart(view.firstChild, 'lit-part')) pinAdopter(view);
    if (view.hasAttribute(DEFER)) view.removeAttribute(DEFER);
  }

  /** The view owns everything between these markers, so the enclosing render leaves them as the view left them. */
  render(): typeof noChange {
    return noChange;
  }
}

/**
 * The hole a `<ui-view>` fills, written at the use site.
 *
 * On the server `@lit-labs/ssr` reaches the renderer's `renderLight()` only
 * through this directive in the element's child part, so the routed markup goes
 * where the template puts it. On the client it wakes the `<ui-view>` it sits
 * in — the enclosing template hydrating is what reaches the directive, parent
 * template first — and resolves to `noChange`, so the walk reads past the
 * interior the server prefixed and a later render of that template leaves the
 * view's own nodes alone. A view holding a served pair is also pinned to {@link
 * hydrateRoot}'s adopter, so it is adopted on its own update even if the app
 * detached it in between; the pin answers once and comes off. On a cold render
 * there is no pair to adopt and no attribute to remove.
 *
 * @example
 * ```ts
 * html`<ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>`;
 * ```
 *
 * @category client
 */
export const uiViewSlot: typeof renderLight = directive(UiViewSlotDirective);

const warnMismatch = (tag: string, error: unknown): void => {
  // DEV folds away in dist/*.js; see check:dev-split and dev-warnings.json.
  if (!import.meta.env.DEV) return;
  console.warn(
    'lit-ui-router-ssr: this element could not adopt the server render, so it rendered over it instead. One static document answers a whole family of urls, so a client that boots into another state reaches this legitimately.',
    tag,
    error,
  );
};

const isPart = (node: Node | null | undefined, data: string): boolean =>
  node?.nodeType === Node.COMMENT_NODE &&
  (node as Comment).data.startsWith(data);

/** Strips {@link servedMarkerPrefix} from one marker comment, leaving anything else alone. */
const revealMarker = (node: Node | null): void => {
  if (!isPart(node, servedMarkerPrefix)) return;
  const comment = node as Comment;
  comment.data = comment.data.slice(servedMarkerPrefix.length);
};

/**
 * Renames one view's served markers back to the ones `hydrate()` reads.
 *
 * A nested `<ui-view>` is left closed: only the outer pair this view's template
 * wrote around it is renamed, because everything inside is that view's own
 * served content and stays hidden until its own wake.
 */
const revealServedMarkers = (node: Node): void => {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) {
      revealMarker(child);
    } else if (child instanceof UiView) {
      revealMarker(child.firstChild);
      revealMarker(child.lastChild);
    } else if (child instanceof Element) {
      revealServedMarkers(child);
    }
  }
};

/** Drops the server's nodes, keeping the outer pair the cold render writes into. */
const clearInterior = (view: UiView): void => {
  for (const node of [...view.childNodes].slice(1, -1)) node.remove();
};

/**
 * Adopts one `<ui-view>`'s served markup, or leaves it ready for the cold
 * render that follows.
 *
 * The element holds what {@link UiViewRenderer} wrote for it: a plain outer
 * part pair, and every marker between them carrying {@link
 * servedMarkerPrefix}. Revealing those markers is what makes the interior
 * readable to `hydrate()`, and it happens here rather than in the enclosing
 * walk so a nested view's own interior stays hidden until that view wakes.
 *
 * An element with no served pair is a cold render — a view the document was
 * drawn without — and is left exactly as it is.
 *
 * An empty pair is the address no state routed. Both comments go, so the
 * element's own render starts on a clean container; the `<slot>` that render
 * writes is inert in light DOM.
 *
 * A mismatch is not a bug in every case: one static document answers a family
 * of urls, so a client can boot into a state the document was not drawn for.
 * `hydrate()` throws on that, and the answer is to drop that one element's
 * server nodes — keeping the outer pair, which the element's own `render()`
 * writes into — rather than a half-built page. `hydrate()` claims the container
 * on its last statement, so a walk that threw leaves nothing to undo.
 *
 * This is the adopter {@link hydrateRoot} provides. The view calls it itself,
 * inside its own `willUpdate`, so every throw path stays inside the mismatch
 * guard: the reveal and the hydrate sit in the fallback together, and nothing
 * escapes into the view's update.
 */
const adopt = (view: UiView): void => {
  if (!isPart(view.firstChild, 'lit-part')) return;
  // Only the pair itself is there, so clearing the element drops exactly those two comments.
  if (view.childNodes.length === 2 && isPart(view.lastChild, '/lit-part')) {
    view.replaceChildren();
    return;
  }
  try {
    revealServedMarkers(view);
    hydrate(view.render(), view, view.renderOptions);
  } catch (error) {
    warnMismatch(view.localName, error);
    clearInterior(view);
  }
};

/**
 * Pins {@link adopt} to the one served view the walk is passing.
 *
 * A view requests the adopter on its own update, which runs after the walk that
 * woke it, and a request only reaches the container's provider while the view
 * is still under the container. This provider sits on the element itself, so
 * the view's own request reaches it at the target phase whether or not the app
 * detached the view in between, and whether or not the root provider is still
 * installed.
 *
 * It answers once and stands down; an element that never wakes carries its
 * listener to the garbage collector.
 */
const pinAdopter = (view: Element): void => {
  let release = (): void => {};
  release = provideContext(view, adoptUiViewContext, (woken) => {
    release();
    adopt(woken);
  });
};

/**
 * Adopts a server-rendered container, and the `<ui-view>`s that wake under it.
 *
 * {@link adoptUiViewContext} is provided on `container` with core's
 * `provideContext()` first, so a view woken by the walk finds it; `hydrate()`
 * then runs over `container`. The walk reaches each `<ui-view>`'s {@link
 * uiViewSlot} part, which wakes that view; the view re-seeks its router,
 * requests the adopter and calls it, which reveals the markers the server
 * prefixed for that view and hydrates the element's own render against them.
 * That hydrate reaches the slot parts of the views nested inside the routed
 * component the same way, parent first. The walk also pins the adopter to every
 * served view it passes, so a view the app detaches between the walk and its
 * own update is still adopted. A view the walk never reached — one outside
 * `container`, or one whose attribute the app cleared itself after the
 * release — is answered by nobody: core drops its held nodes and warns in
 * development.
 *
 * The provider answers synchronously and stops immediate propagation, so an
 * outer provider never answers the same request twice. It outlives this call,
 * because a nested view wakes on its parent's own update rather than inside the
 * root walk. Release it once the page has settled. A second call on the same
 * container throws out of `hydrate()`, which already holds a live render there,
 * and releases its own provider before rethrowing, so the live one keeps
 * answering.
 *
 * The boot is the router first: `router.start()`, await its first successful
 * transition, then this call. The walk commits `.uiRouter` onto `<ui-router>`
 * and each woken `<ui-view>` re-seeks the router before its own first render,
 * so the views find the settled router rather than the placeholder they
 * registered against. Nothing constrains when `lit-ui-router/register` is
 * imported.
 *
 * @example
 * ```ts
 * import { hydrateRoot } from 'lit-ui-router-ssr/client';
 *
 * await booted;
 * const release = hydrateRoot(root, page(router));
 * if (!release) render(page(router), root);
 * ```
 *
 * @param container - the element the server's markup was written into
 * @param value - the same template the server rendered, with every `<ui-view>` hole empty
 * @param options - lit render options, passed on to `hydrate()`
 * @returns the function that releases the provider, or `false` when the container holds nothing to adopt — a cold client render, a dev server
 *
 * @category client
 */
export function hydrateRoot(
  container: HTMLElement,
  value: unknown,
  options: RenderOptions = {},
): false | (() => void) {
  if (
    !container.querySelector(`[${DEFER}]`) &&
    !isPart(container.firstChild, 'lit-part')
  ) {
    return false;
  }
  const release = provideContext(container, adoptUiViewContext, adopt);
  try {
    hydrate(value, container, options);
  } catch (error) {
    release();
    throw error;
  }
  return release;
}
