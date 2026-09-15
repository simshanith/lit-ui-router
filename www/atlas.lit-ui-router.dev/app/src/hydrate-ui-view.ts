/**
 * THE PROTOTYPE OF `lit-ui-router-ssr/client`, kept inside the app.
 *
 * Spike #898 / findings on #829. Nothing here is a library import: this file
 * is what the adopt half of `lit-ui-router-ssr` would ship, written against
 * `lit-ui-router@1.15.0` exactly as published, so the shape can be measured
 * before any library code is cut.
 *
 * THREE PIECES, and each one is a piece the library would own:
 *
 *  1. AN ARMING PATCH FOR LIGHT-DOM LitElements. `@lit-labs/ssr-client`'s own
 *     hydrate support arms an element in `createRenderRoot`, and only when
 *     `this.shadowRoot` exists — so `<ui-view>`, which returns `this`, and
 *     every light-DOM element in this app, is never armed. The signal that
 *     replaces "has a shadow root" is the `defer-hydration` attribute the
 *     server writes: an element that carries it at connect time stays asleep
 *     (no render root, no update) and hydrates instead of rendering when it is
 *     woken. Nothing wakes itself — see `wake()` — so there is no race with
 *     the parent's own hydrate walk.
 *
 *  2. A SHELTER FOR NESTED MARKERS. `hydrate()` walks EVERY `lit-part` comment
 *     under its container at any depth, and reads each one as a part of the
 *     container's own template. A light-DOM child element whose content the
 *     server rendered therefore breaks its parent's walk (a `lit-node` marker
 *     under a non-template state throws outright). A declarative shadow root
 *     shelters those markers because `<template>` content is a separate
 *     fragment; light DOM has no such shelter, so this makes one on the
 *     client: before the parent hydrates, the child's server content is lifted
 *     out from between its part markers into a DocumentFragment, and put back
 *     the instant before the child itself hydrates. The markers themselves
 *     stay, so the parent's walk still finds the part it expects.
 *
 *  3. `<ui-view>`'s TWO OVERRIDES. `connectedCallback` sweeps the element's
 *     authored children into `inner` and the hold render replays them, which
 *     would both eat the server's output and claim the container with a live
 *     ChildPart that `hydrate()` refuses. Asleep, the hold render never runs;
 *     the capture is skipped for that one pass. Waking also has to re-seek the
 *     router: the element upgraded before `<ui-router>` had one.
 */
import { hydrate } from '@lit-labs/ssr-client';
import { LitElement, render } from 'lit';
import { UiView } from 'lit-ui-router/pure';

/** What the arming patch reaches on a LitElement, none of it public API. */
interface Armable {
  render(): unknown;
  renderRoot: HTMLElement | DocumentFragment;
  renderOptions: object;
  requestUpdate(): void;
  performUpdate(): void;
  [ASLEEP]?: boolean;
}

/** What waking a `<ui-view>` reaches, both `private` in the published types. */
interface UiViewInternals {
  adoptProvidedRouter(): void;
  captureContent(): void;
}

const ASLEEP = Symbol('lit-ui-router-ssr/client: awaiting hydration');
const DEFER = 'defer-hydration';

const asArmable = (el: Element): Armable => el as unknown as Armable;

// --- 1. the arming patch ---------------------------------------------------

/** `update()` is protected on LitElement; a patch has to reach it anyway. */
interface UpdateProto {
  update: (this: LitElement, changed: Map<PropertyKey, unknown>) => void;
}
const litProto = LitElement.prototype as unknown as UpdateProto;
const reactiveProto = Object.getPrototypeOf(LitElement.prototype) as UpdateProto;

const litConnected = LitElement.prototype.connectedCallback;
const litUpdate = litProto.update;
const reactiveUpdate = reactiveProto.update;

LitElement.prototype.connectedCallback = function connectedCallback(this: LitElement): void {
  // Asleep: no render root, so `enableUpdating` never runs and no update —
  // no hold render, no claimed container — can happen before `wake()`.
  if (this.hasAttribute(DEFER)) {
    asArmable(this)[ASLEEP] = true;
    return;
  }
  litConnected.call(this);
};

litProto.update = function update(this: LitElement, changed: Map<PropertyKey, unknown>): void {
  const self = asArmable(this);
  if (self[ASLEEP] !== true) {
    litUpdate.call(this, changed);
    return;
  }
  self[ASLEEP] = false;
  // `LitElement.update()` renders; this is the same cycle with `hydrate()` in
  // its place, so the element adopts the server's nodes instead of replacing
  // them. The value has to be read before the reactive half flushes.
  const value = self.render();
  reactiveUpdate.call(this, changed);
  adopt(value, self.renderRoot, self.renderOptions, this.localName);
};

/**
 * Hydrate, or fall back to the cold render this replaces.
 *
 * A mismatch is not a bug in every case: a static host serves ONE document for
 * a whole family of urls (the atlas's `/` answers `/?subject=city`, and its
 * 404 document answers every unrouted path), so the client can legitimately
 * boot into a state the document was not drawn for. lit's `hydrate()` throws
 * on that, and the right answer is the old behaviour — drop the server's nodes
 * for that one element and render — not a half-built page.
 */
function adopt(value: unknown, root: HTMLElement | DocumentFragment, options: object, tag: string): void {
  try {
    hydrate(value, root, options);
    return;
  } catch (error) {
    console.warn(
      `[lit-ui-router-ssr/client] <${tag}> could not adopt the server's render; ` +
        `rendering over it instead`,
      error,
    );
  }
  // A partial walk may have claimed the container; clear both it and the nodes.
  delete (root as unknown as Record<string, unknown>)['_$litPart$'];
  (root as HTMLElement).replaceChildren();
  render(value, root, options);
}

// --- 2. the shelter --------------------------------------------------------

const shelters = new WeakMap<Element, { nodes: Node[]; end: Node }>();
const isMarker = (node: Node, data: string): boolean =>
  node.nodeType === Node.COMMENT_NODE && (node as Comment).data.startsWith(data);

/**
 * Lift a deferred element's server content out from between its part markers,
 * so the container hydrating around it sees an empty part.
 */
function shelter(el: Element): void {
  const kids = [...el.childNodes];
  let start = -1;
  let end = -1;
  for (const [index, node] of kids.entries()) {
    if (start === -1 && isMarker(node, 'lit-part')) start = index;
    if (isMarker(node, '/lit-part')) end = index;
  }
  if (start === -1 || end <= start + 1) return;
  const nodes = kids.slice(start + 1, end);
  for (const node of nodes) node.remove();
  shelters.set(el, { nodes, end: kids[end] as Node });
}

/** Put it back, immediately before the element hydrates against it. */
function unshelter(el: Element): void {
  const held = shelters.get(el);
  if (!held) return;
  shelters.delete(el);
  for (const node of held.nodes) el.insertBefore(node, held.end);
}

// --- 3. waking -------------------------------------------------------------

/** Every element the server deferred, in document order, innermost last. */
let deferred: Element[] = [];
const woken = new WeakSet<Element>();

function wake(el: Element): void {
  woken.add(el);
  unshelter(el);
  el.removeAttribute(DEFER);
  if (el instanceof UiView) {
    // It upgraded before `<ui-router>` carried the real router, so it is
    // registered against the placeholder `<ui-router>` made for itself.
    (el as unknown as UiViewInternals).adoptProvidedRouter();
  }
  const self = asArmable(el);
  litConnected.call(el as LitElement); // render root, then updates are enabled
  self.requestUpdate();
  // Synchronous, so the whole wake — unshelter, hydrate, reveal the next level
  // of sheltered children — happens in one task and nothing can interleave.
  self.performUpdate();
}

/**
 * Hydrate `value` into a container the server rendered, sheltering every
 * deferred element's content from the walk. Returns false when there is
 * nothing to adopt (the artifact build, `vite dev`, a cold client render).
 */
export function hydrateRoot(container: HTMLElement, value: unknown): boolean {
  deferred = [...container.querySelectorAll(`[${DEFER}]`)];
  if (deferred.length === 0) return false;
  // Innermost first: an outer shelter carries the inner element away with it.
  for (const el of [...deferred].reverse()) shelter(el);
  adopt(value, container, {}, container.localName);
  return true;
}

/**
 * Wake every deferred element, outermost first. One pass per level: waking an
 * element reveals the sheltered elements inside it, which the next pass takes.
 * Call it once the boot transition has succeeded — that is the whole of the
 * boot-transition contract, and the `defer-hydration` attribute is its handle.
 */
export function wakeAll(container: HTMLElement): void {
  for (let level = 0; level < 32; level += 1) {
    const batch = deferred.filter((el) => !woken.has(el) && container.contains(el));
    if (batch.length === 0) return;
    for (const el of batch) wake(el);
  }
}

// --- `<ui-view>`: do not eat the server's output ---------------------------

const uiViewConnected = UiView.prototype.connectedCallback;
UiView.prototype.connectedCallback = function connectedCallback(this: UiView): void {
  if (!this.hasAttribute(DEFER)) {
    uiViewConnected.call(this);
    return;
  }
  // `captureContent()` would sweep the server's render into `inner`; the hold
  // render would then replay a clone of it and claim the container.
  const self = this as unknown as UiViewInternals;
  self.captureContent = (): void => {};
  try {
    uiViewConnected.call(this);
  } finally {
    delete (self as Partial<UiViewInternals>).captureContent;
  }
};
