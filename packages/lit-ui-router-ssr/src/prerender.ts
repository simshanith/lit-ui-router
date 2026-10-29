// provideRouter() on a render root, withRouterSync() around a synchronous render, the lit render inside ui-router-server's prerender loop.
import { render } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { TemplateResult } from 'lit';
import type { UIRouterLit } from 'lit-ui-router';
import { provideRouter, withRouterSync } from 'lit-ui-router/context';
import { DefType, isString } from '@uirouter/core';
import type { Verdict } from 'ui-router-server';
import { prerender as prerenderSite } from 'ui-router-server/ssr';
import type {
  PrerenderOptions as SitePrerenderOptions,
  PrerenderResult as SitePrerenderResult,
  RenderContext as SiteRenderContext,
} from 'ui-router-server/ssr';
import { devGate } from '#dev-gate';

import { packageVersion, signatureAttribute } from './signature.js';
import { UiViewRenderer } from './ui-view-renderer.js';

export type {
  EmittedPage,
  FileWriter,
  PrerenderTally,
  RedirectLine,
} from 'ui-router-server/ssr';

type ShellVerdict = Extract<Verdict, { kind: 'shell' }>;

/** What a render hook is handed besides the verdict. */
export interface RenderContext extends SiteRenderContext {
  /** The render's root event target — the one the router was provided on. */
  root: EventTarget;
}

/**
 * Options for {@link prerender}: those of `ui-router-server/ssr`'s loop, with
 * a lit render in place of its `render`.
 */
export interface PrerenderOptions extends Omit<SitePrerenderOptions, 'render'> {
  /**
   * The router the render reads: provided on {@link PrerenderOptions.root | root}
   * for `context-request` and scoped with `withRouterSync` around every render,
   * so `<ui-router>` descendants and the sref attribute directives both find it.
   */
  router: UIRouterLit;
  /**
   * Renders one shell verdict. Return a template and this package renders it,
   * behind the hydration signature; return a string and it is written as-is.
   * Async, so a hook may drive {@link PrerenderOptions.router | router} to the
   * path before it returns.
   */
  renderShell: (
    verdict: ShellVerdict,
    context: RenderContext,
  ) => TemplateResult | string | Promise<TemplateResult | string>;
  /**
   * Wraps a rendered body in the page document — the shell html, its `<title>`,
   * its head. Defaults to the body unchanged. This package never parses or
   * rewrites html.
   */
  document?: (body: string, context: RenderContext) => string | Promise<string>;
  /**
   * The render's root event target. A bare `new EventTarget()` is created when
   * none is passed; either way {@link PrerenderOptions.router | router} is
   * provided on it, it reaches every render on `eventTargetStack`, and it is
   * returned on the result so the caller can attach providers of its own
   * before the call.
   */
  root?: EventTarget;
  /**
   * Element renderers passed through to `@lit-labs/ssr`, verbatim. Defaults to
   * `[UiViewRenderer]` — not `@lit-labs/ssr`'s `[LitElementRenderer]`, which
   * wraps every custom element in a declarative shadow root it never asked for.
   * Pass `[]` for a render with no `<ui-view>` to fill.
   */
  elementRenderers?: RenderInfo['elementRenderers'];
}

/** What {@link prerender} did. */
export interface PrerenderResult extends SitePrerenderResult {
  /** The root event target, created or passed through. */
  root: EventTarget;
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

/** The signature as `prerender()` writes it. */
interface WrittenSignature {
  readonly version: string;
  readonly state: string;
  readonly params: Readonly<Record<string, string | string[]>>;
}

/** The signature of the page `router` currently stands on; config params never reach the url, so they stay out. */
export const signatureOf = (router: UIRouterLit): WrittenSignature => {
  const { $current, params } = router.globals;

  return {
    version: packageVersion,
    state: $current.name,
    params: Object.fromEntries(
      $current
        .parameters()
        .filter((param) => param.location !== DefType.CONFIG)
        .map((param) => [param.id, param.type.encode(params[param.id])]),
    ),
  };
};

/**
 * The signature as one JSON data block. `<` and `>` only ever stand inside a
 * JSON string, where `\u003c` and `\u003e` spell them, so no value can spell
 * `</script` or `<!--` and end the block early.
 */
export const signatureBlock = (signature: WrittenSignature): string => {
  const json = JSON.stringify(signature)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');

  return `<script type="application/json" ${signatureAttribute}>${json}</script>`;
};

/**
 * Renders one page: the signature first, then the render, so the client reads
 * the one before it hydrates the other.
 *
 * @internal
 */
export const renderPage = (
  body: TemplateResult,
  router: UIRouterLit,
  root: EventTarget,
  elementRenderers: RenderInfo['elementRenderers'],
): string =>
  signatureBlock(signatureOf(router)) +
  withRouterSync(router, () =>
    collectResultSync(
      render(body, {
        // a fresh array per render: @lit-labs/ssr mutates the stack
        eventTargetStack: rootedStack(root),
        elementRenderers,
        // every custom element the page holds sleeps until the client's walk reaches it, top-level ones included
        deferHydration: true,
      }),
    ),
  );

const warnUnregistered = (): void => {
  // DEV folds away in dist/*.js; #dev-gate also closes it under node when NODE_ENV is production.
  if (!import.meta.env.DEV || !devGate()) return;

  if (globalThis.customElements?.get('ui-view')) return;
  console.warn(
    'lit-ui-router-ssr: <ui-view> is not defined on the current customElements registry, so every <ui-view> on these pages renders empty. ' +
      'The DOM shim replaces the registry when it finishes installing: load lit-ui-router-ssr/register by dynamic import after the shim, or preload the shim with node --import.',
  );
};

/**
 * Emits a static site from a mount table's verdicts: a shell verdict becomes
 * `<subpath>/index.html`, a redirect becomes a rules line and no page, and the
 * `otherwise` projection becomes the 404 document. The loop is
 * `ui-router-server/ssr`'s `prerender`; this supplies its lit render.
 *
 * The router is provided on the render root for `context-request` and scoped
 * with `withRouterSync` around each render, so a template's `<ui-router>`
 * descendants and its sref attribute directives read the same router. Renders
 * run one at a time: the scope is a module slot, so there is nothing to
 * parallelise.
 *
 * A rendered page opens on its hydration signature: a JSON data block,
 * `<script type="application/json" data-lit-ui-router-ssr>`, naming this
 * package's version and the state and parameter values the router stood on,
 * which `hydrateRoot()` reads before it touches the document. A `renderShell`
 * that returns a string is written as-is, with no signature, so the client
 * renders it cold.
 *
 * Pages are rendered with `deferHydration`, so every custom element one holds
 * carries `defer-hydration` and renders nothing until `hydrateRoot()`'s walk
 * reaches it on the client. A property binding emits only its part marker:
 * the property is set when the page hydrates, so what an element must show on
 * the served page arrives as an attribute or as children.
 *
 * @param options - the mount table, the router, the paths, and the hooks
 * @returns what was emitted, planned or written
 * @throws an `Error` when neither `mounts` nor `resolver` is supplied
 * @throws an `Error` when the 404 document needs a default probe and only a `resolver` is supplied
 *
 * @example
 * ```ts
 * const result = await prerender({
 *   mounts,
 *   router,
 *   outDir: 'dist',
 *   paths: ['/', '/sheet/7B', '/legacy'],
 *   renderShell: async (verdict, { path }) => {
 *     await settle(router, path);
 *     return page();
 *   },
 *   document: (body, { path }) => fillShell(titles.get(path), body),
 * });
 * ```
 */
export async function prerender(
  options: PrerenderOptions,
): Promise<PrerenderResult> {
  const {
    router,
    renderShell,
    document,
    elementRenderers = [UiViewRenderer],
    root = new EventTarget(),
    ...site
  } = options;

  warnUnregistered();

  const renderLit = async (
    verdict: ShellVerdict,
    siteContext: SiteRenderContext,
  ): Promise<string> => {
    const context: RenderContext = { ...siteContext, root };
    const body = await renderShell(verdict, context);

    const markup = isString(body)
      ? body
      : renderPage(body, router, root, elementRenderers);

    return document ? document(markup, context) : markup;
  };

  const uninstall = provideRouter(root, router);

  try {
    const result = await prerenderSite({ ...site, render: renderLit });

    return { ...result, root };
  } finally {
    uninstall();
  }
}
