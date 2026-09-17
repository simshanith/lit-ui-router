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
import type { AdoptableView } from 'lit-ui-router/context';
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
    if (servedPair(view)) pinAdopter(view);
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
 * hydrateRoot}'s adopter, so a view the app detaches before its own update —
 * which sleeps until it is attached again — is adopted on its return; the pin
 * answers for that one view, once, and comes off. On a cold render there is no
 * pair to adopt and no attribute to remove.
 *
 * @example
 * ```ts
 * html`<ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>`;
 * ```
 *
 * @category client
 */
export const uiViewSlot: typeof renderLight = directive(UiViewSlotDirective);

const warnMismatch = (view: AdoptableView, error: unknown): void => {
  // DEV folds away in dist/*.js; see check:dev-split and dev-warnings.json.
  if (!import.meta.env.DEV) return;
  console.warn(
    'lit-ui-router-ssr: this element could not adopt the server render, so it rendered over it instead. One static document answers a whole family of urls, so a client that boots into another state reaches this legitimately.',
    view.localName,
    error,
    // A view with no routed component of its own is also what an unbooted router looks like.
    ...(view instanceof UiView && view.viewContext
      ? []
      : [
          'lit-ui-router-ssr: this view had no routed component to adopt against, which is also what a router that never started, or whose first transition was not awaited, looks like: call router.start(), await its first successful transition, then hydrateRoot().',
        ]),
  );
};

const isPart = (node: Node | null | undefined, data: string): boolean =>
  node?.nodeType === Node.COMMENT_NODE &&
  (node as Comment).data.startsWith(data);

/**
 * The opening marker of the pair the server wrote around a view's routed
 * markup: the first plain `lit-part` comment among the element's children.
 *
 * Whitespace the parser kept, a foreign comment and an element an extension
 * injected all stand in front of it without hiding it, and a marker the server
 * prefixed is not one — a view's interior is its own until its wake.
 */
const servedPair = (view: Element): Comment | undefined => {
  for (const child of view.childNodes) {
    if (isPart(child, 'lit-part')) return child as Comment;
  }
  return undefined;
};

/** Whether anything under `node` still carries {@link servedMarkerPrefix}. */
const hasServedMarkers = (node: Node): boolean => {
  for (const child of node.childNodes) {
    if (isPart(child, servedMarkerPrefix)) return true;
    if (child instanceof Element && hasServedMarkers(child)) return true;
  }
  return false;
};

/** Strips {@link servedMarkerPrefix} from one marker comment, leaving anything else alone. */
const revealMarker = (node: Node | null | undefined): void => {
  if (!isPart(node, servedMarkerPrefix)) return;
  const comment = node as Comment;
  comment.data = comment.data.slice(servedMarkerPrefix.length);
};

/** The outer pair of a nested view, whatever stands in front of it. */
const revealNestedPair = (view: Element): void => {
  const markers = [...view.childNodes].filter((node) =>
    isPart(node, servedMarkerPrefix),
  );
  revealMarker(markers[0]);
  revealMarker(markers.at(-1));
};

/**
 * Renames one view's served markers back to the ones `hydrate()` reads.
 *
 * A nested `<ui-view>` is left closed: only the outer pair this view's template
 * wrote around it is renamed, because everything inside is that view's own
 * served content and stays hidden until its own wake. A declarative shadow root
 * is not closed that way — the same render prefixed its markers, and the
 * element's own hydrate reads them at this wake.
 */
const revealServedMarkers = (node: Node): void => {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) {
      revealMarker(child);
    } else if (child instanceof UiView) {
      revealNestedPair(child);
    } else if (child instanceof Element) {
      if (child.shadowRoot) revealServedMarkers(child.shadowRoot);
      revealServedMarkers(child);
    }
  }
};

/** Renames every marker under `node`, closed views included, so nothing is left hidden. */
const revealEveryMarker = (node: Node): void => {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.COMMENT_NODE) {
      revealMarker(child);
    } else if (child instanceof Element) {
      if (child.shadowRoot) revealEveryMarker(child.shadowRoot);
      revealEveryMarker(child);
    }
  }
};

/**
 * Drops a served render standing under no pair: every child from the first one
 * that is, or holds, a served marker, down to the end.
 *
 * What stands ahead of that is the author's, and core takes it as the view's
 * fallback set at this wake.
 */
const dropServedRender = (view: Element): void => {
  const children = [...view.childNodes];
  const from = children.findIndex(
    (child) =>
      isPart(child, servedMarkerPrefix) ||
      (child instanceof Element && hasServedMarkers(child)),
  );
  if (from < 0) return;
  for (const child of children.slice(from)) child.remove();
};

/** Drops the server's nodes from between the pair, which the element renders after. */
const clearInterior = (open: Comment): void => {
  for (
    let node = open.nextSibling;
    node && !isPart(node, '/lit-part');
    node = open.nextSibling
  ) {
    node.remove();
  }
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
 * An empty pair is the address no state routed. Both comments stay: they are
 * the enclosing template's own part markers, and the element renders after
 * them, which is also where a cleared interior leaves it.
 *
 * A view with no pair holds no render of ours: what stands in it is what the
 * author wrote around the hole, and this leaves it alone — the view takes it as
 * its own fallback set at this wake and parks it for the component it renders.
 * A view still carrying prefixed markers under a pair this cannot find is a
 * mismatch, and says so; those nodes are a render's, and they go — every child
 * from the first one that is, or holds, a served marker. What the author wrote
 * ahead of the render stays, and the view takes it as its fallback set.
 *
 * A mismatch is not a bug in every case: one static document answers a family
 * of urls, so a client can boot into a state the document was not drawn for.
 * `hydrate()` throws on that, and the answer is to drop that one element's
 * server nodes rather than a half-built page. `hydrate()` claims the container
 * on its last statement, so a walk that threw leaves nothing to undo.
 *
 * This is the adopter {@link hydrateRoot} provides. The view calls it itself,
 * inside its own `willUpdate`, so every throw path stays inside the mismatch
 * guard: the reveal and the hydrate sit in the fallback together, and nothing
 * escapes into the view's update.
 */
const adopt = (view: AdoptableView): void => {
  const open = servedPair(view);
  if (!open) {
    if (hasServedMarkers(view)) {
      warnMismatch(view, 'the served part pair is gone');
      dropServedRender(view);
    }
    return;
  }
  // The address no state routed: nothing between the pair to adopt, and the element renders after it.
  if (isPart(open.nextSibling, '/lit-part')) return;
  try {
    revealServedMarkers(view);
    hydrate(view.render(), view, view.renderOptions);
  } catch (error) {
    warnMismatch(view, error);
    clearInterior(open);
  }
};

/** The views this walk, or an earlier one, already pinned. */
const pinned = new WeakSet<Element>();

/**
 * Pins {@link adopt} to the one served view the walk is passing.
 *
 * A view requests the adopter on its own update, which runs after the walk that
 * woke it, and a request only reaches the container's provider while the view
 * is still under the container. A view the app detaches in between sleeps until
 * it is attached again, and that can be anywhere. This provider sits on the
 * element itself, so the view's own request reaches it at the target phase
 * wherever it wakes, and whether or not the root provider is still installed.
 *
 * It answers its own view once and stands down, and a second walk over that
 * element adds nothing; an element that never wakes carries its listener to the
 * garbage collector. A descendant view whose request passes through on its way
 * out is adopted too, and leaves the pin armed for the view it belongs to.
 */
const pinAdopter = (view: Element): void => {
  if (pinned.has(view)) return;
  pinned.add(view);
  let release = (): void => {};
  release = provideContext(view, adoptUiViewContext, (woken) => {
    // A descendant's request passes through this element and is answered; only this view's own spends the pin.
    if (woken === view) release();
    adopt(woken);
  });
};

/** Whether the container's leading nodes open a render `hydrate()` can read. */
const isServed = (container: HTMLElement): boolean => {
  for (const child of container.childNodes) {
    if (isPart(child, 'lit-part')) return true;
    if (child.nodeType === Node.COMMENT_NODE) continue;
    if (child.nodeType === Node.TEXT_NODE && !(child as Text).data.trim()) {
      continue;
    }
    return false;
  }
  return false;
};

/** Leaves the container as a cold render finds it: nothing asleep, nothing hidden. */
const makeCold = (container: HTMLElement): void => {
  for (const element of container.querySelectorAll(`[${DEFER}]`)) {
    element.removeAttribute(DEFER);
  }
  revealEveryMarker(container);
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
 * served view it passes: a view the app detaches between the walk and its own
 * update sleeps until it is attached again, and the pin is what adopts it then,
 * after this call's provider is released. A view the walk never reached — one
 * outside `container`, or one whose attribute the app cleared itself after the
 * release — is answered by nobody: core drops its held nodes and warns in
 * development. An element the render deferred and wrote no marker for is woken
 * once the walk has finished, since nothing in the walk reaches it.
 *
 * The provider answers synchronously and stops immediate propagation, so an
 * outer provider never answers the same request twice. It outlives this call,
 * because a nested view wakes on its parent's own update rather than inside the
 * root walk. Release it once the page has settled. A second call on the same
 * container throws out of `hydrate()`, which already holds a live render there,
 * and releases its own provider before rethrowing, so the live one keeps
 * answering.
 *
 * A `hydrate()` that throws is rethrown, over a container left cold-renderable:
 * nothing asleep behind `defer-hydration`, no marker still hidden. The caller
 * renders over it.
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
  if (!isServed(container)) return false;
  const release = provideContext(container, adoptUiViewContext, adopt);
  try {
    hydrate(value, container, options);
  } catch (error) {
    release();
    makeCold(container);
    throw error;
  }
  // `@lit-labs/ssr` defers a custom element it wrote no marker for, so the walk passed it by; a `<ui-view>` still asleep is a nested one, waiting on its parent's update.
  for (const element of container.querySelectorAll(`[${DEFER}]`)) {
    if (!(element instanceof UiView)) element.removeAttribute(DEFER);
  }
  return release;
}
