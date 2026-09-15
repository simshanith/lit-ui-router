/**
 * @module
 * @mergeModuleWith <project>
 */
// The adopt half: arm light-DOM LitElements, hydrate the server's tree, wake it once the boot transition has succeeded.
import { hydrate } from '@lit-labs/ssr-client';
import { LitElement, render } from 'lit';
import type { RenderOptions } from 'lit';
import { UiView } from 'lit-ui-router/pure';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

/** Marks an element that connected under `defer-hydration` and has not yet been woken. */
const ASLEEP = Symbol('lit-ui-router-ssr/client: awaiting hydration');

/** The LitElement internals arming reaches, none of them public API. */
interface Armable {
  render(): unknown;
  renderRoot: HTMLElement | DocumentFragment;
  renderOptions: RenderOptions;
  requestUpdate(): void;
  performUpdate(): void;
  [ASLEEP]?: boolean;
}

/** `update()` is protected on LitElement; the patch has to reach it anyway. */
interface UpdateProto {
  update: (this: LitElement, changed: Map<PropertyKey, unknown>) => void;
}

const asArmable = (element: Element): Armable => element as unknown as Armable;

const litConnected = LitElement.prototype.connectedCallback;
const litProto = LitElement.prototype as unknown as UpdateProto;
const reactiveProto = Object.getPrototypeOf(
  LitElement.prototype,
) as UpdateProto;
const litUpdate = litProto.update;
const reactiveUpdate = reactiveProto.update;

let armed = false;

const warnMismatch = (tag: string, error: unknown): void => {
  // DEV folds away in dist/*.js; see check:dev-split and dev-warnings.json.
  if (!import.meta.env.DEV) return;
  console.warn(
    'lit-ui-router-ssr: this element could not adopt the server render, so it rendered over it instead. One static document answers a whole family of urls, so a client that boots into another state reaches this legitimately.',
    tag,
    error,
  );
};

/**
 * Hydrates, or falls back to the cold render this replaces.
 *
 * A mismatch is not a bug in every case: one static document answers a family
 * of urls, so a client can boot into a state the document was not drawn for.
 * `hydrate()` throws on that, and the answer is the behaviour it replaced —
 * drop the server's nodes for that one element and render — not a half-built
 * page.
 */
const adopt = (
  value: unknown,
  root: HTMLElement | DocumentFragment,
  options: RenderOptions,
  tag: string,
): void => {
  try {
    hydrate(value, root, options);
    return;
  } catch (error) {
    warnMismatch(tag, error);
  }
  // A partial walk may have claimed the container; clear both it and the nodes.
  delete (root as unknown as { _$litPart$?: unknown })._$litPart$;
  (root as HTMLElement).replaceChildren();
  render(value, root, options);
};

/**
 * Arms every light-DOM `LitElement` for hydration, once.
 *
 * `@lit-labs/ssr-client`'s own hydrate support arms an element in
 * `createRenderRoot`, and only when it has a shadow root — so `<ui-view>`,
 * whose render root is the element itself, is never armed. The signal that
 * replaces "has a shadow root" is the `defer-hydration` attribute the server
 * writes: an element carrying it at connect time stays asleep (no render root,
 * no update), and hydrates rather than renders when {@link wakeAll} wakes it.
 * Nothing wakes itself, so there is no race with a host's own hydrate walk.
 *
 * Call this before `lit-ui-router` registers its elements — registration
 * upgrades the server's markup, and an element that upgrades unarmed renders
 * over the nodes this was meant to adopt. An entry that hydrates therefore
 * imports `lit-ui-router/pure`, which registers nothing, and calls
 * `lit-ui-router/register` (or the root entry) after this.
 *
 * @example
 * ```ts
 * import { armLightDom, hydrateRoot, wakeAll } from 'lit-ui-router-ssr/client';
 *
 * armLightDom();
 * await import('lit-ui-router/register');
 * ```
 *
 * @category client
 */
export function armLightDom(): void {
  if (armed) return;
  armed = true;

  LitElement.prototype.connectedCallback = function connectedCallback(
    this: LitElement,
  ): void {
    // Asleep: no render root, so `enableUpdating` never runs and nothing can render before wake().
    if (this.hasAttribute(DEFER)) {
      asArmable(this)[ASLEEP] = true;
      return;
    }
    litConnected.call(this);
  };

  litProto.update = function update(
    this: LitElement,
    changed: Map<PropertyKey, unknown>,
  ): void {
    const self = asArmable(this);
    if (self[ASLEEP] !== true) {
      litUpdate.call(this, changed);
      return;
    }
    self[ASLEEP] = false;
    // The same cycle `LitElement.update()` runs, with `hydrate()` where its render is; the value has to be read before the reactive half flushes.
    const value = self.render();
    reactiveUpdate.call(this, changed);
    adopt(value, self.renderRoot, self.renderOptions, this.localName);
  };
}

/** A deferred element's lifted content, and the marker it goes back before. */
interface Shelter {
  nodes: Node[];
  end: Node;
}

const shelters = new WeakMap<Element, Shelter>();
const woken = new WeakSet<Element>();
const pending = new WeakMap<HTMLElement, Element[]>();

const isMarker = (node: Node, data: string): boolean =>
  node.nodeType === Node.COMMENT_NODE &&
  (node as Comment).data.startsWith(data);

/**
 * Lifts a deferred element's server content out from between its part markers,
 * so the container hydrating around it sees an empty part.
 *
 * `hydrate()` walks every `lit-part` comment under its container at any depth
 * and reads each one as a part of that container's own template, so a light-DOM
 * child whose content the server rendered breaks its host's walk. A declarative
 * shadow root shelters those markers because `<template>` content is a separate
 * fragment; light DOM has no such shelter, so this makes one. The markers
 * themselves stay, so the host's walk still finds the part it expects.
 */
const shelter = (element: Element): void => {
  const kids = [...element.childNodes];
  let start = -1;
  let end = -1;
  for (const [index, node] of kids.entries()) {
    if (start === -1 && isMarker(node, 'lit-part')) start = index;
    if (isMarker(node, '/lit-part')) end = index;
  }
  if (start === -1 || end <= start + 1) return;
  const nodes = kids.slice(start + 1, end);
  for (const node of nodes) node.remove();
  shelters.set(element, { nodes, end: kids[end] });
};

/** Puts it back, immediately before the element hydrates against it. */
const unshelter = (element: Element): void => {
  const held = shelters.get(element);
  if (!held) return;
  shelters.delete(element);
  for (const node of held.nodes) element.insertBefore(node, held.end);
};

const wake = (element: Element): void => {
  woken.add(element);
  unshelter(element);
  element.removeAttribute(DEFER);
  // It upgraded before `<ui-router>` carried the real router, so it registered against the placeholder one.
  if (element instanceof UiView) element.adoptProvidedRouter();
  const self = asArmable(element);
  litConnected.call(element as LitElement);
  self.requestUpdate();
  // Synchronous, so unshelter, hydrate and the reveal of the next level happen in one task and nothing can interleave.
  self.performUpdate();
};

/**
 * Hydrates `value` into a container the server rendered, sheltering every
 * deferred element's content from the walk.
 *
 * The deferred elements are held against `container` for {@link wakeAll}; they
 * stay asleep, and so does everything the server drew inside them, until it is
 * called.
 *
 * @param container - the element the server's markup was written into
 * @param value - the same template the server rendered, with every `<ui-view>` hole empty
 * @param options - lit render options, passed on to `hydrate()` and to the fallback render
 * @returns `false` when the container holds nothing to adopt — a cold client render, a dev server
 *
 * @category client
 */
export function hydrateRoot(
  container: HTMLElement,
  value: unknown,
  options: RenderOptions = {},
): boolean {
  const deferred = [...container.querySelectorAll(`[${DEFER}]`)];
  pending.set(container, deferred);
  if (deferred.length === 0) return false;
  // Innermost first: an outer shelter carries the inner element away with it.
  for (const element of [...deferred].reverse()) shelter(element);
  adopt(value, container, options, container.localName);
  return true;
}

/**
 * Wakes every element {@link hydrateRoot} deferred, outermost first.
 *
 * One pass per level: waking an element reveals the sheltered elements inside
 * it, which the next pass takes. Call it once the boot transition has
 * succeeded — that is the whole of the boot-transition contract, and
 * `defer-hydration` is its handle.
 *
 * @param container - the container {@link hydrateRoot} was given
 *
 * @category client
 */
export function wakeAll(container: HTMLElement): void {
  const deferred = pending.get(container) ?? [];
  for (;;) {
    const batch = deferred.filter(
      (element) => !woken.has(element) && container.contains(element),
    );
    if (batch.length === 0) return;
    for (const element of batch) wake(element);
  }
}
