/**
 * The client half: `bootstrap()` starts the router and hydrates the prerendered
 * root, or renders it cold, and each served `<ui-view>` the walk wakes adopts
 * its markup through `uiViewSlot`.
 *
 * @module
 */
import { hydrate } from '@lit-labs/ssr-client';
import { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
import type { RenderLightHost } from '@lit-labs/ssr-client/directives/render-light.js';
import { isFunction, RejectType } from '@uirouter/core';
import type { Transition } from '@uirouter/core';
import { noChange, render } from 'lit';
import type { ChildPart, RenderOptions } from 'lit';
import { directive } from 'lit/directive.js';
import type { PartInfo } from 'lit/directive.js';
import { getDirectiveClass } from 'lit/directive-helpers.js';
import { provideContext } from 'lit-ui-router/context';
import { UiView } from 'lit-ui-router/pure';
import type { UIRouterLit } from 'lit-ui-router/pure';
import { seed } from 'ui-router-server/ssr/client';
import type { ResolvePayload } from 'ui-router-server/ssr/client';
import { devGate } from '#dev-gate';
import { adoptUiViewContext } from './adopt-context.js';
import type { AdoptableView } from './adopt-context.js';
import { servedMarkerPrefix } from './served-markers.js';
import { packageVersion, routeOf, signatureSelector } from './signature.js';
import type { HydrationSignature } from './signature.js';

export {
  adoptUiViewContext,
  type AdoptableView,
  type AdoptUiViewContext,
  type AdoptUiViewContextKey,
} from './adopt-context.js';

export {
  isServedViewClass,
  type ServedUiView,
  type ServedUiViewConstructor,
  servedViewBrand,
  withServedRender,
} from './served-view.js';

export type { HydrationSignature } from './signature.js';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

/**
 * What a served `<ui-view>`'s wake came to.
 *
 * - `adopted`: the element hydrated its served nodes, and they are the live ones.
 * - `fell-back`: the served pair did not match the render the client booted
 *   into, or was lost; the view dropped the served interior and rendered cold.
 * - `none`: nothing to adopt — an empty served pair, the address no state
 *   routed, or a view the document served no markers for.
 */
export type AdoptOutcome = 'adopted' | 'fell-back' | 'none';

/**
 * The name of the event a served `<ui-view>` dispatches once its wake's
 * outcome is known, in the `ui-view:` house style of the served markers.
 */
export const uiViewAdoptEventName = 'ui-view:adopt' as const;

/**
 * The detail of {@link UiViewAdoptEvent}.
 */
export interface UiViewAdoptDetail {
  /** What the wake came to. */
  readonly outcome: AdoptOutcome;
  /** What `hydrate()` threw, or why the pair was lost; present only on `fell-back`. */
  readonly error?: unknown;
}

/**
 * Dispatched from a served `<ui-view>` at its wake, once per view, bubbling and
 * composed, in production as in development.
 */
export type UiViewAdoptEvent = CustomEvent<UiViewAdoptDetail>;

/**
 * Receives each served view's outcome, as {@link HydrateRootOptions.onAdopt}.
 */
export type AdoptReporter = (
  view: Element,
  outcome: AdoptOutcome,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- the thrown value a fallback caught, as the platform reports one
  error?: unknown,
) => void;

/**
 * {@link hydrateRoot}'s options: lit's render options, plus the outcome
 * callback.
 */
export interface HydrateRootOptions extends RenderOptions {
  /**
   * Called with each served view's outcome, at the same moment as its
   * {@link UiViewAdoptEvent}, for every view this call's walk reaches —
   * including one the pin adopts after the provider is released.
   */
  onAdopt?: AdoptReporter;
}

declare global {
  interface HTMLElementEventMap {
    /** A served `<ui-view>`'s hydration outcome; see {@link UiViewAdoptEvent}. */
    'ui-view:adopt': UiViewAdoptEvent;
  }
}

// The class `@lit-labs/ssr` routes to `renderLight()` is not exported; its directive function is, and lit's helper reads the class back off a call.
const RenderLightDirective = getDirectiveClass(renderLight())!;

// Subclassed rather than re-flagged: the flag is minified to a different name in the production build of `@lit-labs/ssr-client`, and inheritance carries whichever one this build ships.
class UiViewSlotDirective extends RenderLightDirective {
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
    // SAFETY: the directive renders only in child position, where lit passes the `ChildPart` itself.
    const view = (part as ChildPart).parentNode;

    if (!(view instanceof Element)) return;

    // The pin keys off the served pair, not the wake below: where that marker is there, lit's own walk cleared the attribute before this part was reached.
    if (servedPair(view)) pinAdopter(view, walkPolicy);

    if (view.hasAttribute(DEFER)) view.removeAttribute(DEFER);
  }

  /** The view owns everything between these markers, so the enclosing render leaves them as the view left them. */
  render(): typeof noChange {
    return noChange;
  }

  /** A host `renderLight()` answers, as it does for ssr-client's own directive; a `<ui-view>` has none and keeps its nodes. */
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- hands on a host's renderLight(), which lit types unknown
  override update(part: ChildPart): unknown {
    // SAFETY: a host's `renderLight`, when present, is the `RenderLightHost` method ssr-client calls.
    const host = part.parentNode as Partial<RenderLightHost>;

    return isFunction(host.renderLight) ? host.renderLight() : noChange;
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
 */
export const uiViewSlot: typeof renderLight = directive(UiViewSlotDirective);

/** How one walk's adoptions report: the walk's `onAdopt`, and whether a view's mismatch warns. */
interface AdoptPolicy {
  readonly reporter?: AdoptReporter;
  /** Set by a boot that already warned the document was drawn for another state. */
  readonly quiet?: boolean;
}

/** The policy of the walk in progress, which the pins it sets carry. */
let walkPolicy: AdoptPolicy = {};

/** Runs `walk` with `policy` as the one the pins it sets carry. */
const walkWith = (policy: AdoptPolicy, walk: () => void): void => {
  const outer = walkPolicy;
  walkPolicy = policy;

  try {
    walk();
  } finally {
    walkPolicy = outer;
  }
};

/**
 * Reports one view's outcome: the event from the view, then the root's
 * callback. A callback that throws goes to `reportError`, as the platform
 * reports a throwing event listener; without it (Node, DOM emulators) the
 * error escapes into the view's update, after its nodes are settled.
 */
const report = (
  view: Element,
  reporter: AdoptReporter | undefined,
  outcome: AdoptOutcome,
  cause?: unknown,
): void => {
  const detail: UiViewAdoptDetail =
    outcome === 'fell-back' ? { outcome, error: cause } : { outcome };

  view.dispatchEvent(
    new CustomEvent(uiViewAdoptEventName, {
      bubbles: true,
      composed: true,
      detail,
    }),
  );

  try {
    reporter?.(view, outcome, cause);
  } catch (thrown) {
    if (!isFunction(globalThis.reportError)) {
      throw thrown;
    }

    globalThis.reportError(thrown);
  }
};

const warnMismatch = (
  view: AdoptableView,
  cause: unknown,
  policy: AdoptPolicy,
): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate() || policy.quiet) return;
  console.warn(
    'lit-ui-router-ssr: this element could not adopt the server render, so it rendered over it instead. One static document answers a whole family of urls, so a client that boots into another state reaches this legitimately.',
    view.localName,
    cause,
    // A view with no routed component of its own is also what an unbooted router looks like.
    ...(view instanceof UiView && view.viewContext
      ? []
      : [
          'lit-ui-router-ssr: this view had no routed component to adopt against, which is also what a router that never started, or whose first transition was not awaited, looks like: boot with bootstrap(), or call router.start(), await its first successful transition, then hydrateRoot().',
        ]),
  );
};

const isComment = (node: Node | null | undefined): node is Comment =>
  node?.nodeType === Node.COMMENT_NODE;

const isPart = (node: Node | null | undefined, data: string): node is Comment =>
  isComment(node) && node.data.startsWith(data);

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
    if (isPart(child, 'lit-part')) return child;
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
  node.data = node.data.slice(servedMarkerPrefix.length);
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

/** How far `node` moves the part depth: 1 opens, -1 closes, 0 is anything else. */
const partStep = (node: Node): number => {
  if (isPart(node, 'lit-part')) return 1;

  return isPart(node, '/lit-part') ? -1 : 0;
};

/**
 * Drops the server's nodes from between the pair, which the element renders
 * after: everything up to the close matching `open`, nested parts included.
 * The reveal ran before the hydrate threw, so every marker here is plain.
 */
const clearInterior = (open: Comment): void => {
  let depth = 0;

  for (let node = open.nextSibling; node; node = open.nextSibling) {
    const step = partStep(node);

    if (step < 0 && depth === 0) return;
    depth += step;
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
 *
 * Every exit reports the outcome once, from the view and to the policy's reporter, after
 * the view's nodes are settled: `adopted` once hydrated, `fell-back` with the
 * cause once the served render is dropped, `none` when there was nothing to
 * adopt.
 */
const adopt = (view: AdoptableView, policy: AdoptPolicy): void => {
  const { reporter } = policy;
  const open = servedPair(view);

  if (!open) {
    if (!hasServedMarkers(view)) return report(view, reporter, 'none');
    const error = 'the served part pair is gone';
    warnMismatch(view, error, policy);
    dropServedRender(view);

    return report(view, reporter, 'fell-back', error);
  }

  // The address no state routed: nothing between the pair to adopt, and the element renders after it.
  if (isPart(open.nextSibling, '/lit-part')) {
    return report(view, reporter, 'none');
  }

  try {
    revealServedMarkers(view);
    walkWith(policy, () => hydrate(view.render(), view, view.renderOptions));
    wakeUnmarked(view);
  } catch (error) {
    warnMismatch(view, error, policy);
    clearInterior(open);

    return report(view, reporter, 'fell-back', error);
  }

  report(view, reporter, 'adopted');
};

/** Whether `element` sits inside a `<ui-view>` below `root`. */
const isInNestedView = (element: Element, root: Element): boolean => {
  for (
    let parent = element.parentElement;
    parent && parent !== root;
    parent = parent.parentElement
  ) {
    if (parent instanceof UiView) return true;
  }

  return false;
};

/**
 * Wakes what `@lit-labs/ssr` deferred under `root` and wrote no marker for, so
 * no walk reaches it: every deferred element but a `<ui-view>` and what one
 * holds, since each view's interior wakes with that view's own adoption.
 */
const wakeUnmarked = (root: Element): void => {
  for (const element of root.querySelectorAll(`[${DEFER}]`)) {
    if (!(element instanceof UiView) && !isInNestedView(element, root)) {
      element.removeAttribute(DEFER);
    }
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
 * The pin carries the policy of the walk that set it, so the view reports to
 * its `onAdopt` wherever and whenever it wakes.
 */
const pinAdopter = (view: Element, policy: AdoptPolicy): void => {
  if (pinned.has(view)) return;
  pinned.add(view);
  let release = (): void => {};

  release = provideContext(view, adoptUiViewContext, (woken) => {
    // A descendant's request passes through this element and is answered; only this view's own spends the pin.
    if (woken === view) release();
    adopt(woken, policy);
  });
};

/** Whether parsed JSON is an object whose `version` is a string, the only member HydrationSignature requires. */
const isHydrationSignature = (value: unknown): value is HydrationSignature =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string';

/** The JSON a signature block carries, or null when it does not parse to one with a version. */
const parseSignature = (json: string): HydrationSignature | null => {
  try {
    const signature: unknown = JSON.parse(json);

    return isHydrationSignature(signature) ? signature : null;
  } catch {
    return null;
  }
};

/**
 * Reads the hydration signature `prerender()` wrote ahead of the render a
 * container holds: the version of this package that drew the document, and
 * the state and parameter values it was drawn for.
 *
 * The signature is a `<script type="application/json" data-lit-ui-router-ssr>`
 * data block among the container's own children, so this reads no deeper than
 * they are; the first one wins. It reads the same before and after a
 * {@link hydrateRoot} that adopts, which leaves the block in place; one that
 * returns `false` clears the container.
 *
 * Only `version` is checked. `state` and `params` are whatever the block
 * carries, so narrow them before use. Read it before {@link hydrateRoot}, which
 * clears a container it does not adopt.
 *
 * @example
 * ```ts
 * import { hydrateRoot, readHydrationSignature } from 'lit-ui-router-ssr/client';
 *
 * await booted;
 * const { state } = readHydrationSignature(root) ?? {};
 * const drawnForBoot = state === router.globals.current.name;
 * const release = hydrateRoot(root, page(router));
 * ```
 *
 * @param container - the element the server's markup was written into
 * @returns the signature, or `null` when the container holds none, or one that
 * does not parse to an object with a string `version`
 */
export function readHydrationSignature(
  container: ParentNode,
): HydrationSignature | null {
  const block = signatureBlockIn(container);

  return block ? parseSignature(block.text) : null;
}

/** The container's own signature block, if it holds one. */
const signatureBlockIn = (
  container: ParentNode,
): HTMLScriptElement | undefined =>
  [...container.children].find((child): child is HTMLScriptElement =>
    child.matches(signatureSelector),
  );

/** Whether the block is followed, past whitespace, by the opening marker of the render it precedes. */
const precedesRender = (block: Element): boolean => {
  let node = block.nextSibling;

  // SAFETY: `nodeType` is `TEXT_NODE`, checked first.
  while (node?.nodeType === Node.TEXT_NODE && !(node as Text).data.trim()) {
    node = node.nextSibling;
  }

  return isPart(node, 'lit-part');
};

/** The release line a version belongs to: `0.<minor>` below 1.0, where a minor breaks, and the major above it. */
const releaseLine = (version: string): string => {
  const [major = '', minor = ''] = version.split('.');

  return major === '0' ? `0.${minor}` : major;
};

const warnVersionSkew = (served: string): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;
  console.warn(
    'lit-ui-router-ssr: this document was prerendered by a release line this client does not adopt, so hydrateRoot() left it to a cold render. Prerender it again with the version the client ships. Prerendered by, then client:',
    served,
    packageVersion,
  );
};

const warnMarkersStripped = (): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;
  console.warn(
    'lit-ui-router-ssr: this document carries a hydration signature but no lit-part marker follows it, so hydrateRoot() left it to a cold render. hydrate() reads html comments: serve prerendered pages without stripping them.',
  );
};

/** The container's signature when this build adopts it, ahead of a render with its markers; either miss warns in development. */
const readAdoptable = (container: HTMLElement): HydrationSignature | null => {
  const block = signatureBlockIn(container);
  const signature = block && parseSignature(block.text);

  if (!signature) return null;

  if (releaseLine(signature.version) !== releaseLine(packageVersion)) {
    warnVersionSkew(signature.version);

    return null;
  }

  if (precedesRender(block)) return signature;
  warnMarkersStripped();

  return null;
};

/** Empties the container, so a cold render draws the page once and no served view wakes without an adopter. */
const makeCold = (container: HTMLElement): void => {
  container.replaceChildren();
};

/**
 * Adopts a server-rendered container, and the `<ui-view>`s that wake under it.
 *
 * The container's {@link readHydrationSignature | hydration signature} is read
 * first, and decides whether there is anything to adopt. A container with no
 * signature renders cold, and so does one whose signature names another release
 * line of this package — another minor below 1.0, another major from 1.0 — with
 * a development warning naming both versions, and so does one whose signature
 * no `lit-part` marker follows, as a comment-stripping minifier leaves it. Each
 * time the container is emptied and this returns `false`, so the caller's
 * `render()` draws the page once. A container this adopts keeps its signature.
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
 * once the walk has finished, since nothing in the walk reaches it — except
 * one inside a `<ui-view>`, which wakes once that view has hydrated its own
 * render, so a routed element never wakes ahead of the view that routes it.
 *
 * The provider answers synchronously and stops immediate propagation, so an
 * outer provider never answers the same request twice. It outlives this call,
 * because a nested view wakes on its parent's own update rather than inside the
 * root walk. Release it once the page has settled. A second call on the same
 * container throws out of `hydrate()`, which already holds a live render there,
 * and releases its own provider before rethrowing, so the live one keeps
 * answering.
 *
 * Each served view that wakes under the walk reports what its wake came to — an
 * {@link AdoptOutcome} — once, as a {@link UiViewAdoptEvent} dispatched from
 * the view, and to `options.onAdopt` when given. The pin carries that callback,
 * so a view adopted after the release still reaches it.
 *
 * A `hydrate()` that throws is rethrown, over a container emptied the same
 * way. The caller renders into it.
 *
 * {@link bootstrap} runs the whole boot around this call. Called directly, the
 * boot is the router first: `router.start()`, await its first successful
 * transition, then this call. The walk commits `.uiRouter` onto `<ui-router>`
 * and each woken `<ui-view>` re-seeks the router before its own first render,
 * so the views find the settled router rather than the placeholder they
 * registered against. Nothing constrains when `lit-ui-router-ssr/register` is
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
 * @param options - lit render options, passed on to `hydrate()`, and `onAdopt`
 * @returns the function that releases the provider, or `false`, over an emptied container, when there is nothing to adopt — no signature, as on a cold client render or a dev server, one from another release line, or one no render marker follows
 */
export function hydrateRoot(
  container: HTMLElement,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- any value lit renders, as lit's render() and hydrate() take it
  value: unknown,
  options: HydrateRootOptions = {},
): false | (() => void) {
  const { onAdopt, ...renderOptions } = options;

  if (!readAdoptable(container)) {
    makeCold(container);

    return false;
  }

  return adoptRoot(container, value, renderOptions, { reporter: onAdopt });
}

/** {@link hydrateRoot} past its signature check: provide the adopter, walk, and wake what the walk passed by. */
const adoptRoot = (
  container: HTMLElement,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- any value lit renders, as lit's render() and hydrate() take it
  value: unknown,
  renderOptions: RenderOptions,
  policy: AdoptPolicy,
): (() => void) => {
  const release = provideContext(container, adoptUiViewContext, (view) =>
    adopt(view, policy),
  );

  try {
    walkWith(policy, () => hydrate(value, container, renderOptions));
  } catch (error) {
    release();
    makeCold(container);
    throw error;
  }

  wakeUnmarked(container);

  return release;
};

/** What {@link bootstrap} came to, once the page is live. */
export type BootstrapOutcome = 'adopted' | 'cold';

/** What {@link bootstrap} resolves with. */
export interface BootstrapResult {
  /**
   * `adopted`: the served document was hydrated, and each served view reported
   * its own {@link AdoptOutcome}. `cold`: the container was emptied and the
   * template rendered into it.
   */
  readonly outcome: BootstrapOutcome;
  /**
   * Whether the boot transition landed on the state and url parameters the
   * document's signature names; `false` when there was no signature to adopt,
   * or no transition landed.
   */
  readonly drawnFor: boolean;
  /**
   * The boot transition's `Rejection`, or what the root `hydrate()` threw;
   * present only on a cold boot that one of them caused.
   */
  readonly error?: unknown;
}

/** {@link bootstrap}'s options: {@link HydrateRootOptions}, plus the boot transition's seed. */
export interface BootstrapOptions extends HydrateRootOptions {
  /**
   * Resolved values the document was drawn with, handed to `seed` from
   * `ui-router-server/ssr/client` before the router starts, so the boot
   * transition adopts them in place of running their resolve functions.
   */
  readonly payload?: ResolvePayload;
}

/** How the boot transition ended: the transition that succeeded, the rejection that failed it, or neither when the url started none. */
type BootLanding =
  | { readonly transition: Transition }
  | { readonly error: unknown }
  | Record<string, never>;

/** Starts `router` and settles on its boot transition, following redirects and supersessions to the one that lands. */
const startBoot = (router: UIRouterLit): Promise<BootLanding> =>
  new Promise<BootLanding>((resolve) => {
    const { transitionService } = router;
    let created = false;

    const off = (): void => {
      offCreate();
      offSuccess();
      offError();
    };

    const land = (landing: BootLanding): void => {
      off();
      resolve(landing);
    };

    // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
    const offCreate = transitionService.onCreate({}, () => {
      created = true;
    }) as () => void;

    // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
    const offSuccess = transitionService.onSuccess({}, (transition) =>
      land({ transition }),
    ) as () => void;

    // SAFETY: hook registration returns its deregistration function, typed only as `Function`.
    const offError = transitionService.onError({}, (transition) => {
      const error = transition.error();

      // A redirect or a newer transition took over; the boot lands with whichever succeeds.
      if (error.type !== RejectType.SUPERSEDED) land({ error });
    }) as () => void;

    try {
      router.start();
    } catch (error) {
      off();
      throw error;
    }

    if (!created) land({});
  });

/** Whether the router stands where the signature says the document was drawn. */
const isDrawnFor = (
  signature: HydrationSignature,
  router: UIRouterLit,
): boolean =>
  JSON.stringify([signature.state, signature.params]) ===
  JSON.stringify(routeOf(router.globals));

const warnBootElsewhere = (
  signature: HydrationSignature,
  router: UIRouterLit,
  fellBack: number,
): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;
  console.warn(
    'lit-ui-router-ssr: this document was drawn for another state than the one the client booted into, so bootstrap() rendered the views that differ cold and adopted the rest. One static document answers a whole family of urls, and a boot transition can redirect, so this is legitimate. Drawn for, booted into, views rendered cold:',
    signature.state,
    router.globals.current.name,
    fellBack,
  );
};

/** Resolves once every awake, connected `<ui-view>` under `container` has updated, including those an update woke; a view that cannot update is not waited for. */
const settleViews = async (container: HTMLElement): Promise<void> => {
  const settled = new Set<Element>();

  for (;;) {
    const awake = [...container.querySelectorAll('*')].filter(
      (element): element is UiView =>
        element instanceof UiView &&
        element.isConnected &&
        !element.hasAttribute(DEFER) &&
        !settled.has(element),
    );

    if (awake.length === 0) return;

    for (const view of awake) settled.add(view);
    await Promise.all(awake.map((view) => view.updateComplete));
  }
};

/** Empties the container and renders `value` into it. */
const renderCold = (
  container: HTMLElement,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- any value lit renders, as lit's render() takes it
  value: unknown,
  renderOptions: RenderOptions,
): void => {
  makeCold(container);
  render(value, container, renderOptions);
};

/**
 * Boots `router` into the page `container` holds, and resolves once that page
 * is live.
 *
 * It owns the whole client boot. `options.payload`, when given, seeds the boot
 * transition first. The container's {@link readHydrationSignature | signature}
 * is read before anything else touches the document; a container {@link
 * hydrateRoot} would not adopt — no signature, another release line, stripped
 * markers — is emptied and `value` rendered into it at once, and the router
 * then starts. Otherwise the router starts, the call waits for the boot
 * transition to land, following redirects to the one that succeeds, and then
 * hydrates the container with `value`.
 *
 * The boot decides once what the page does:
 *
 * - The boot lands where the signature says the document was drawn: every
 *   served view adopts, and a view that still mismatches warns in development,
 *   since that is a template the two halves render differently.
 * - The boot lands elsewhere — a static host serving one document for a
 *   family of urls, or a redirect: the views that match adopt, and the views
 *   that differ render cold without a warning of their own. Once the page is
 *   live, one development warning names both states and how many views
 *   rendered cold, when any did.
 * - The boot fails, or the url starts no transition: the container is emptied
 *   and `value` rendered cold. The root `hydrate()` throwing, as over a
 *   mutated document, does the same. The call resolves rather than rejects.
 *
 * Every served view still reports its own {@link AdoptOutcome}, as a {@link
 * UiViewAdoptEvent} and to `options.onAdopt`. The call waits for each awake
 * `<ui-view>` to finish updating, nested views included, then releases the
 * adopter `hydrateRoot()` provided; a view the app detached keeps its pin.
 *
 * @example
 * ```ts
 * import { bootstrap } from 'lit-ui-router-ssr/client';
 *
 * const { outcome } = await bootstrap(router, root, page(router));
 * ```
 *
 * @param router - the client router, its states registered and not yet started
 * @param container - the element the server's markup was written into, or an empty one
 * @param value - the same template the server rendered, with every `<ui-view>` hole empty
 * @param options - lit render options, `onAdopt`, and the boot transition's `payload`
 * @returns what the boot came to, once every awake view has updated
 * @throws what `router.start()` throws, as on a router already started
 * @throws the `TypeError` `seed` throws on a payload with no `resolves`, before the router starts
 */
export async function bootstrap(
  router: UIRouterLit,
  container: HTMLElement,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- any value lit renders, as lit's render() and hydrate() take it
  value: unknown,
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const { onAdopt, payload, ...renderOptions } = options;
  const disarm = seed(router, payload);
  const signature = readAdoptable(container);

  if (!signature) {
    renderCold(container, value, renderOptions);
    const landing = await startBoot(router);
    disarm();
    await settleViews(container);

    return { outcome: 'cold', drawnFor: false, ...pickError(landing) };
  }

  const landing = await startBoot(router);
  disarm();

  if (!('transition' in landing)) {
    renderCold(container, value, renderOptions);
    await settleViews(container);

    return { outcome: 'cold', drawnFor: false, ...pickError(landing) };
  }

  const drawnFor = isDrawnFor(signature, router);
  let fellBack = 0;

  const reporter: AdoptReporter = (view, outcome, error) => {
    if (outcome === 'fell-back') fellBack += 1;
    onAdopt?.(view, outcome, error);
  };

  let release: () => void;

  try {
    release = adoptRoot(container, value, renderOptions, {
      reporter,
      quiet: !drawnFor,
    });
  } catch (error) {
    render(value, container, renderOptions);
    await settleViews(container);

    return { outcome: 'cold', drawnFor, error };
  }

  await settleViews(container);
  release();

  if (!drawnFor && fellBack > 0) warnBootElsewhere(signature, router, fellBack);

  return { outcome: 'adopted', drawnFor };
}

/** The landing's error, as a result member, when it carries one. */
const pickError = (landing: BootLanding): { error?: unknown } =>
  'error' in landing ? { error: landing.error } : {};
