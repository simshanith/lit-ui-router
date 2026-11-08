// The lit render of one page the router already stands on: the step prerender() runs per page, and the entry a host that owns the request calls.
import { render } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { TemplateResult } from 'lit';
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';
import { provideRouter, withRouterSync } from 'lit-ui-router/context';
import { dehydrate as dehydrateLanded } from 'ui-router-server/ssr';
import type {
  DehydrateOptions,
  DehydrateResult,
  ResolvePayload,
} from 'ui-router-server/ssr';
import { devGate } from '#dev-gate';

import { LightElementRenderer } from './light-element-renderer.js';
import { withShadowFallback } from './shadow-fallback-renderer.js';
import { packageVersion, routeOf, signatureAttribute } from './signature.js';
import { collectDrawnViews, UiViewRenderer } from './ui-view-renderer.js';

/**
 * The element renderers a page is drawn with when none are passed.
 *
 * @internal
 */
export const defaultElementRenderers: RenderInfo['elementRenderers'] = [
  UiViewRenderer,
  LightElementRenderer,
];

/** What a page's hydration signature carries of its resolve payload. */
export interface PagePayload {
  /**
   * The bytes the payload adds to the page's signature as written: its
   * `resolves` and `transported` members, escaped as the block spells them.
   */
  bytes: number;
  /**
   * The resolves `dehydrate` left out of the payload because their value is
   * not plain JSON data and no transporter carries it, each to re-run on the
   * client. Present only when the `dehydrate` option drew the payload: a
   * payload passed in whole is reported by its bytes alone.
   */
  unserializable?: DehydrateResult['unserializable'];
}

/** Options for {@link renderToString}. */
export interface RenderToStringOptions {
  /**
   * The router the render reads, already standing on the page: settle it on
   * the request's path first. It is provided on
   * {@link RenderToStringOptions.root | root} for `context-request` and scoped
   * with `withRouterSync` around the render, so `<ui-router>` descendants and
   * the sref attribute directives both find it, and the hydration signature
   * names the state and parameter values it stands on.
   */
  router: UIRouterLit;
  /**
   * The render's root event target. A bare `new EventTarget()` is created when
   * none is passed. The router is provided on it for the render alone and the
   * provider removed before this returns, so a caller may attach providers of
   * its own to it beforehand.
   */
  root?: EventTarget;
  /**
   * Element renderers passed through to `@lit-labs/ssr`, verbatim. Defaults to
   * `[UiViewRenderer, LightElementRenderer]`, as `prerender()`'s option of the
   * same name does, and a list passed here replaces it the same way.
   */
  elementRenderers?: RenderInfo['elementRenderers'];
  /**
   * Draws the page's resolve payload with `dehydrate` from
   * `ui-router-server/ssr`, called with these options on the transition the
   * router last landed. The payload goes into the hydration signature, and
   * `bootstrap()` adopts its resolves on the client in place of running them.
   * Pass `{}` to draw every resolve `dehydrate` draws by default.
   */
  dehydrate?: DehydrateOptions;
  /**
   * A resolve payload drawn by hand, in place of
   * {@link RenderToStringOptions.dehydrate | `dehydrate`}, for the hydration
   * signature to carry. Passing both throws.
   */
  payload?: ResolvePayload;
}

/** One page {@link renderToString} drew. */
export interface RenderedPage {
  /**
   * The page's markup: its hydration signature, then the template's render.
   * A fragment for the host to place in its document, never a document itself.
   */
  html: string;
  /** What the signature carries of the resolve payload, when it carries one. */
  payload?: PagePayload;
}

// litServerRoot must lead: @lit-labs/ssr 4.1 makes any other first entry its own __eventTargetParent and the composed-path walk never ends; read per call because the shim installs on import.
const rootedStack = (root: EventTarget): EventTarget[] => {
  // SAFETY: the @lit-labs/ssr DOM shim sets `litServerRoot` to an `EventTarget`, or leaves it unset.
  const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
    .litServerRoot;

  return litServerRoot && litServerRoot !== root
    ? [litServerRoot, root]
    : [root];
};

/** The signature as a rendered page writes it. */
interface WrittenSignature {
  readonly version: string;
  readonly state: string;
  readonly params: Readonly<Record<string, string | string[]>>;
  readonly views?: readonly string[];
  readonly resolves?: ResolvePayload['resolves'];
  readonly transported?: ResolvePayload['transported'];
}

/** What a page's signature carries of its resolve payload. */
type DrawnResolves = Pick<ResolvePayload, 'resolves' | 'transported'>;

/** The signature of the page `router` currently stands on, encoded as the client compares it, carrying the views drawn and the payload's `resolves` and `transported` when given. */
export const signatureOf = (
  router: UIRouterLit,
  drawn?: DrawnResolves,
  views?: readonly string[],
): WrittenSignature => {
  const [state, params] = routeOf(router.globals);

  const signature = views
    ? { version: packageVersion, state, params, views }
    : { version: packageVersion, state, params };

  if (!drawn) return signature;

  const { resolves, transported } = drawn;

  return transported
    ? { ...signature, resolves, transported }
    : { ...signature, resolves };
};

/**
 * The signature as one JSON data block. `<` and `>` only ever stand inside a
 * JSON string, where `<` and `>` spell them, so no value can spell
 * `</script` or `<!--` and end the block early.
 */
export const signatureBlock = (signature: WrittenSignature): string => {
  const json = JSON.stringify(signature)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');

  return `<script type="application/json" ${signatureAttribute}>${json}</script>`;
};

const utf8Length = (text: string): number =>
  new TextEncoder().encode(text).length;

/** The bytes `drawn` adds to the signature of the page `router` stands on. */
const payloadBytes = (router: UIRouterLit, drawn: DrawnResolves): number =>
  utf8Length(signatureBlock(signatureOf(router, drawn))) -
  utf8Length(signatureBlock(signatureOf(router)));

/**
 * Renders one page: the signature first, then the render, so the client reads
 * the one before it hydrates the other. The signature names every `<ui-view>`
 * the render drew a routed component into, so it is written after the render.
 *
 * @internal
 */
export const renderPage = (
  body: TemplateResult,
  router: UIRouterLit,
  root: EventTarget,
  elementRenderers: RenderInfo['elementRenderers'],
  drawn?: DrawnResolves,
): string => {
  const [markup, views] = collectDrawnViews(() =>
    withRouterSync(router, () =>
      collectResultSync(
        render(body, {
          // a fresh array per render: @lit-labs/ssr mutates the stack
          eventTargetStack: rootedStack(root),
          elementRenderers: withShadowFallback(elementRenderers),
          // every custom element the page holds sleeps until the client's walk reaches it, top-level ones included
          deferHydration: true,
        }),
      ),
    ),
  );

  return signatureBlock(signatureOf(router, drawn, views)) + markup;
};

/**
 * {@link renderPage}, reporting what the signature carries of `drawn`'s payload.
 *
 * @internal
 */
export const renderDrawn = (
  body: TemplateResult,
  router: UIRouterLit,
  root: EventTarget,
  elementRenderers: RenderInfo['elementRenderers'],
  { payload: drawn, unserializable }: Partial<DehydrateResult>,
): RenderedPage => {
  const html = renderPage(body, router, root, elementRenderers, drawn);

  if (!drawn) return { html };

  const bytes = payloadBytes(router, drawn);

  return {
    html,
    payload: unserializable ? { bytes, unserializable } : { bytes },
  };
};

/**
 * Warns when `<ui-view>` is not registered, so every view on the page renders empty.
 *
 * @internal
 */
export const warnUnregistered = (): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;

  if (globalThis.customElements?.get('ui-view')) return;
  console.warn(
    'lit-ui-router-ssr: <ui-view> is not defined on the current customElements registry, so every <ui-view> on these pages renders empty. ' +
      'The DOM shim replaces the registry when it finishes installing: prerender through serverRouterPlugin from lit-ui-router-ssr/vite, which preloads both, load lit-ui-router-ssr/register by dynamic import after the shim, or preload the shim with node --import.',
  );
};

// A host renders once per request; the registry check needs to speak once per process.
let registryChecked = false;

const drawnBy = (
  router: UIRouterLit,
  options: Pick<RenderToStringOptions, 'dehydrate' | 'payload'>,
): Partial<DehydrateResult> => {
  const { dehydrate, payload } = options;

  if (dehydrate && payload)
    throw new Error(
      'renderToString: pass `dehydrate` or `payload`, not both; a payload drawn by hand comes from `dehydrate()` itself',
    );

  if (!dehydrate) return { payload };

  // SAFETY: `peekTail()` is typed `Transition` and returns `undefined` on an empty queue.
  const landed = router.globals.successfulTransitions.peekTail() as
    | Transition
    | undefined;

  return landed ? dehydrateLanded(landed, dehydrate) : {};
};

/**
 * Renders the page a router already stands on to a string, for a host that
 * owns the request: a framework route or a worker settles the router on the
 * request's path, decides the response, and calls this for the page's markup.
 * It is the render `prerender()` runs for every page it writes, so the markup
 * is the same bytes `prerender()` hands `document` for the same template and
 * router.
 *
 * The markup opens on the page's hydration signature, the JSON data block
 * `hydrateRoot()` reads, then the template's render, drawn with
 * `deferHydration` so every custom element sleeps until the client's walk
 * reaches it. The status, the redirect and the document around the markup
 * are the host's: settle with `settle`, read a `redirectTo` with
 * `redirectedTo` from `ui-router-server/ssr`, and wrap the markup in the
 * shell html.
 *
 * The render is synchronous and collects the whole page into one string. The
 * router is scoped to it through a module slot, so renders on one thread never
 * interleave.
 *
 * @param template - the page, rendered with the router in scope
 * @param options - the router, and the renderers and resolve payload to draw with
 * @returns the page's markup, and what its signature carries of the resolve payload
 * @throws an `Error` when both `dehydrate` and `payload` are supplied
 *
 * @example
 * ```ts
 * import { renderToString, settle } from 'lit-ui-router-ssr';
 * import { redirectedTo } from 'ui-router-server/ssr';
 *
 * // `router` serves the mount at /releases; `subpath` is the request's path within it.
 * const redirect = redirectedTo(router, await settle(router, subpath));
 *
 * if (redirect)
 *   return new Response(null, {
 *     status: redirect.status,
 *     headers: { Location: `/releases${redirect.url}` },
 *   });
 *
 * const { html } = renderToString(page(router), { router, dehydrate: {} });
 *
 * return new Response(shell(html), {
 *   headers: { 'Content-Type': 'text/html; charset=utf-8' },
 * });
 * ```
 */
export const renderToString = (
  template: TemplateResult,
  options: RenderToStringOptions,
): RenderedPage => {
  const {
    router,
    root = new EventTarget(),
    elementRenderers = defaultElementRenderers,
  } = options;

  const drawn = drawnBy(router, options);

  if (!registryChecked) {
    registryChecked = true;
    warnUnregistered();
  }

  const uninstall = provideRouter(root, router);

  try {
    return renderDrawn(template, router, root, elementRenderers, drawn);
  } finally {
    uninstall();
  }
};
