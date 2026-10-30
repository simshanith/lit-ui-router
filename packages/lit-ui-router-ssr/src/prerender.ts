// provideRouter() on a render root, withRouterSync() around a synchronous render, the lit render inside ui-router-server's prerender loop.
import { render } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { TemplateResult } from 'lit';
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';
import { provideRouter, withRouterSync } from 'lit-ui-router/context';
import { isString } from '@uirouter/core';
import type { Verdict } from 'ui-router-server';
import { prerender as prerenderSite } from 'ui-router-server/prerender';
import type {
  FileWriter,
  PrerenderOptions as SitePrerenderOptions,
  PrerenderResult as SitePrerenderResult,
  RenderContext as SiteRenderContext,
} from 'ui-router-server/prerender';
import type { ResolvePayload } from 'ui-router-server/ssr';
import { devGate } from '#dev-gate';

import { LightElementRenderer } from './light-element-renderer.js';
import { responder } from './respond.js';
import type { BoundResponses } from './respond.js';
import { packageVersion, routeOf, signatureAttribute } from './signature.js';
import { UiViewRenderer } from './ui-view-renderer.js';

export type {
  EmittedPage,
  FileWriter,
  PrerenderTally,
  RedirectLine,
} from 'ui-router-server/prerender';

type ShellVerdict = Extract<Verdict, { kind: 'shell' }>;

type ResponseVerdict = Extract<Verdict, { kind: 'response' }>;

// Built at runtime so no node: specifier enters the static module graph; a supplied `write` needs none.
const NODE_FS = 'node:fs/promises';

// Typed structurally so src never pulls in @types/node.
interface NodeFsPromises {
  mkdir(
    path: string,
    options: { recursive: boolean },
  ): Promise<string | undefined>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
}

const dirOf = (file: string): string => {
  const cut = file.lastIndexOf('/');

  return cut === -1 ? '' : file.slice(0, cut);
};

const nodeWrite: FileWriter = async (file, body) => {
  // SAFETY: `NODE_FS` names `node:fs/promises`, whose `mkdir` and `writeFile` take these shapes.
  const { mkdir, writeFile } = (await import(NODE_FS)) as NodeFsPromises;
  const dir = dirOf(file);

  if (dir) await mkdir(dir, { recursive: true });
  await writeFile(file, body, 'utf8');
};

/** What a render hook is handed besides the verdict. */
export interface RenderContext extends SiteRenderContext {
  /** The render's root event target — the one the router was provided on. */
  root: EventTarget;
}

/**
 * Options for {@link prerender}: those of `ui-router-server/prerender`'s loop, with
 * a lit render in place of its `render`.
 */
export interface PrerenderOptions extends Omit<
  SitePrerenderOptions,
  'render' | 'respond' | 'write'
> {
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
   * `[UiViewRenderer, LightElementRenderer]` — not `@lit-labs/ssr`'s
   * `[LitElementRenderer]`, which wraps every custom element in a declarative
   * shadow root it never asked for. `LightElementRenderer` answers only for a
   * class `LightDomHydrating` branded. A list passed here replaces the default,
   * so keep `LightElementRenderer` in it, ahead of any renderer that writes a
   * shadow root, to draw those elements. Pass `[]` for a render with no
   * `<ui-view>` to fill.
   */
  elementRenderers?: RenderInfo['elementRenderers'];
  /**
   * Handlers for the router's response states, keyed by state name, as
   * {@link responder} takes them. A path that matches one settles
   * {@link PrerenderOptions.router | router} on it and writes what its
   * handler answers: a 2xx body at the path its url spells, or a 3xx as a
   * rules line. The handler's request is a GET for the path at
   * {@link PrerenderOptions.origin | origin}. Without this option, a response
   * state throws.
   */
  responses?: BoundResponses;
  /**
   * The origin of the request a response handler gets, such as
   * `https://example.com`, so a handler that builds absolute urls from
   * `request.url` writes the site's own. Defaults to `http://localhost`.
   */
  origin?: string;
  /** Writes a file. Defaults to `node:fs`, imported lazily on first write. */
  write?: FileWriter;
  /**
   * Draws the resolve payload for a rendered page, handed the transition the
   * router last landed, once `renderShell` has returned a template. The
   * payload's `resolves` go into the page's hydration signature, beside the
   * state and parameters the router stands on, and the client adopts them on
   * boot in place of running those resolve functions. Return `undefined` to
   * write none. Without this hook no page carries resolves.
   *
   * `dehydrate` from `ui-router-server/ssr` draws the payload; its
   * documentation says which values it leaves out.
   *
   * @example
   * ```ts
   * payload: (transition, { path }) => {
   *   const { payload, unserializable } = dehydrate(transition);
   *   for (const { state, token } of unserializable)
   *     console.warn(`${path}: ${state}.${token} re-runs on the client`);
   *   return payload;
   * },
   * ```
   */
  payload?: (
    transition: Transition,
    context: RenderContext,
  ) => ResolvePayload | undefined;
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
  readonly resolves?: ResolvePayload['resolves'];
}

/** The signature of the page `router` currently stands on, encoded as the client compares it, carrying `resolves` when given. */
export const signatureOf = (
  router: UIRouterLit,
  resolves?: ResolvePayload['resolves'],
): WrittenSignature => {
  const [state, params] = routeOf(router.globals);

  return resolves
    ? { version: packageVersion, state, params, resolves }
    : { version: packageVersion, state, params };
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
  resolves?: ResolvePayload['resolves'],
): string =>
  signatureBlock(signatureOf(router, resolves)) +
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
 * `<subpath>/index.html`, a response state becomes the body or rules line its
 * handler in {@link PrerenderOptions.responses | responses} answers, a
 * redirect becomes a rules line and no page, and the `otherwise` projection
 * becomes the 404 document. The loop is
 * `ui-router-server/prerender`'s `prerender`; this supplies its lit render.
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
 * which `hydrateRoot()` reads before it touches the document. A
 * {@link PrerenderOptions.payload | `payload`} hook adds the resolved values
 * the page was drawn with, which `bootstrap()` adopts. A `renderShell`
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
    elementRenderers = [UiViewRenderer, LightElementRenderer],
    root = new EventTarget(),
    write = nodeWrite,
    payload,
    responses,
    origin = 'http://localhost',
    ...site
  } = options;

  warnUnregistered();

  const payloadOf = (context: RenderContext): ResolvePayload | undefined => {
    if (!payload) return undefined;

    // SAFETY: `peekTail()` is typed `Transition` and returns `undefined` on an empty queue.
    const landed = router.globals.successfulTransitions.peekTail() as
      | Transition
      | undefined;

    return landed && payload(landed, context);
  };

  const renderLit = async (
    verdict: ShellVerdict,
    siteContext: SiteRenderContext,
  ): Promise<string> => {
    const context: RenderContext = { ...siteContext, root };
    const body = await renderShell(verdict, context);

    const markup = isString(body)
      ? body
      : renderPage(
          body,
          router,
          root,
          elementRenderers,
          payloadOf(context)?.resolves,
        );

    return document ? document(markup, context) : markup;
  };

  const uninstall = provideRouter(root, router);

  try {
    const respond = (
      verdict: ResponseVerdict,
      { path }: SiteRenderContext,
    ): Promise<Response> => {
      if (responses === undefined)
        throw new Error(
          `prerender: '${path}' matched response state '${verdict.state}'; pass \`responses\` to answer it`,
        );

      return responder(router, responses)(
        verdict,
        new Request(new URL(path, origin)),
      );
    };

    const result = await prerenderSite({
      ...site,
      render: renderLit,
      respond,
      write,
    });

    return { ...result, root };
  } finally {
    uninstall();
  }
}
