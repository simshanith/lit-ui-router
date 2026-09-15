/**
 * @module
 * @mergeModuleWith <project>
 */
// The adopt half: one `hydrate()` on the root, and every served `<ui-view>` the walk wakes adopts its own markup through `UiView.hydrator`.
import { hydrate } from '@lit-labs/ssr-client';
import type { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
import { noChange } from 'lit';
import type { ChildPart, RenderOptions } from 'lit';
import { Directive, directive } from 'lit/directive.js';
import type { PartInfo } from 'lit/directive.js';
import { UiView } from 'lit-ui-router/pure';

/** The attribute `@lit-labs/ssr` writes on a server-rendered custom element. */
const DEFER = 'defer-hydration';

class UiViewSlotDirective extends Directive {
  /** The flag `@lit-labs/ssr` reads to route this part to `UiViewRenderer.renderLight()`. */
  static _$litRenderLight = true;

  /**
   * Wakes the `<ui-view>` this part sits in.
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
    if (view instanceof Element && view.hasAttribute(DEFER)) {
      view.removeAttribute(DEFER);
    }
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
 * view's own nodes alone. On a cold render there is no attribute to remove.
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

const isPart = (node: Node | null): boolean =>
  node?.nodeType === Node.COMMENT_NODE &&
  (node as Comment).data.startsWith('lit-part');

/**
 * Hydrates one `<ui-view>`, or leaves it ready for the cold render that follows.
 *
 * A mismatch is not a bug in every case: one static document answers a family
 * of urls, so a client can boot into a state the document was not drawn for.
 * `hydrate()` throws on that, and the answer is to drop that one element's
 * server nodes — keeping the outer pair, which the element's own `render()`
 * writes into — rather than a half-built page. `hydrate()` claims the container
 * on its last statement, so a walk that threw leaves nothing to undo.
 */
const adopt = (
  value: unknown,
  container: HTMLElement,
  options?: RenderOptions,
): void => {
  try {
    hydrate(value, container, options);
  } catch (error) {
    warnMismatch(container.localName, error);
    for (const node of [...container.childNodes].slice(1, -1)) node.remove();
  }
};

/**
 * Adopts a server-rendered container, and arms every `<ui-view>` under it to
 * adopt its own markup.
 *
 * `UiView.hydrator` is installed first, so a view woken by the walk finds it;
 * `hydrate()` then runs over `container`. The walk reaches each `<ui-view>`'s
 * {@link uiViewSlot} part, which wakes that view: it reveals the markers the
 * server prefixed for it and hydrates its own routed component, and that
 * hydrate reaches the slot parts of the views nested inside the component the
 * same way, parent first.
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
 * if (!hydrateRoot(root, page(router))) render(page(router), root);
 * ```
 *
 * @param container - the element the server's markup was written into
 * @param value - the same template the server rendered, with every `<ui-view>` hole empty
 * @param options - lit render options, passed on to `hydrate()`
 * @returns `false` when the container holds nothing to adopt — a cold client render, a dev server
 *
 * @category client
 */
export function hydrateRoot(
  container: HTMLElement,
  value: unknown,
  options: RenderOptions = {},
): boolean {
  if (!container.querySelector(`[${DEFER}]`) && !isPart(container.firstChild)) {
    return false;
  }
  UiView.hydrator ??= adopt;
  hydrate(value, container, options);
  return true;
}
