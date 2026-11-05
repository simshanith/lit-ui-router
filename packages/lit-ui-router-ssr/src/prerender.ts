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
  EmittedPage,
  FileWriter,
  PrerenderOptions as SitePrerenderOptions,
  PrerenderResult as SitePrerenderResult,
  RenderContext as SiteRenderContext,
} from 'ui-router-server/prerender';
import { dehydrate as dehydrateLanded } from 'ui-router-server/ssr';
import type {
  DehydrateOptions,
  DehydrateResult,
  ResolvePayload,
} from 'ui-router-server/ssr';
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
   * `https://example.com`. Defaults to `http://lit-ui-router-ssr`, a host that
   * names this package so a url built from it stands out in the output. A
   * handler that answers with paths needs none; pass the site's own origin
   * when a handler builds absolute urls from `request.url`.
   */
  origin?: string;
  /** Writes a file. Defaults to `node:fs`, imported lazily on first write. */
  write?: FileWriter;
  /**
   * Draws each rendered page's resolve payload with `dehydrate` from
   * `ui-router-server/ssr`, called with these options on the transition the
   * router last landed, once `renderShell` has returned a template. The
   * payload's `resolves` go into the page's hydration signature, beside the
   * state and parameters the router stands on, and the client adopts them on
   * boot in place of running those resolve functions. Pass `{}` to draw every
   * resolve `dehydrate` draws by default. Without this option or
   * {@link PrerenderOptions.payload | `payload`}, no page carries resolves.
   *
   * `dehydrate`'s documentation says which values it leaves out and how
   * `shouldDehydrate` and `transport` act. The payload's
   * `transported` marks go into the signature too, so a value a transporter
   * carried is rebuilt when `bootstrap()` gets the same `transport`.
   *
   * @example
   * ```ts
   * dehydrate: {
   *   shouldDehydrate: ({ token }) => token !== 'manifest',
   *   transport,
   * },
   * ```
   */
  dehydrate?: DehydrateOptions;
  /**
   * Draws the resolve payload for a rendered page by hand, in place of
   * {@link PrerenderOptions.dehydrate | `dehydrate`}: handed the transition the
   * router last landed, once `renderShell` has returned a template, it returns
   * the payload the page's signature carries, or `undefined` to write none.
   * Passing both this and `dehydrate` throws.
   *
   * @example
   * Shape the payload `dehydrate` draws before it is written:
   * ```ts
   * import { dehydrate } from 'ui-router-server/ssr';
   *
   * payload: (transition, { path }) =>
   *   path.startsWith('/drafts/')
   *     ? undefined
   *     : dehydrate(transition, { transport }).payload,
   * ```
   */
  payload?: (
    transition: Transition,
    context: RenderContext,
  ) => ResolvePayload | undefined;
}

/** What a page's hydration signature carries of its resolve payload. */
export interface PagePayload {
  /**
   * The bytes the payload adds to the page's signature as written: its
   * `resolves` and `transported` members, escaped as the block spells them.
   */
  bytes: number;
  /**
   * The resolves {@link PrerenderOptions.dehydrate | `dehydrate`} left out of
   * the payload because their value is not plain JSON data and no transporter
   * carries it, each to re-run on the client. Present only when `dehydrate`
   * drew the payload: a {@link PrerenderOptions.payload | `payload`} hook
   * returns the payload alone.
   */
  unserializable?: DehydrateResult['unserializable'];
}

/** A page {@link prerender} emitted. */
export interface PrerenderedPage extends EmittedPage {
  /**
   * What the page's signature carries of its resolve payload. Absent on a page
   * that carries none: one drawn with no payload, one `renderShell` returned
   * as a string, and a response state's body.
   */
  payload?: PagePayload;
}

/** What {@link prerender} did. */
export interface PrerenderResult extends Omit<SitePrerenderResult, 'pages'> {
  /** Every page emitted or planned, in enumeration order. */
  pages: PrerenderedPage[];
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
  readonly transported?: ResolvePayload['transported'];
}

/** What a page's signature carries of its resolve payload. */
type DrawnResolves = Pick<ResolvePayload, 'resolves' | 'transported'>;

/** The signature of the page `router` currently stands on, encoded as the client compares it, carrying the payload's `resolves` and `transported` when given. */
export const signatureOf = (
  router: UIRouterLit,
  drawn?: DrawnResolves,
): WrittenSignature => {
  const [state, params] = routeOf(router.globals);
  const signature = { version: packageVersion, state, params };

  if (!drawn) return signature;

  const { resolves, transported } = drawn;

  return transported
    ? { ...signature, resolves, transported }
    : { ...signature, resolves };
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

const utf8Length = (text: string): number =>
  new TextEncoder().encode(text).length;

/** The bytes `drawn` adds to the signature of the page `router` stands on. */
const payloadBytes = (router: UIRouterLit, drawn: DrawnResolves): number =>
  utf8Length(signatureBlock(signatureOf(router, drawn))) -
  utf8Length(signatureBlock(signatureOf(router)));

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
  drawn?: DrawnResolves,
): string =>
  signatureBlock(signatureOf(router, drawn)) +
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
      'The DOM shim replaces the registry when it finishes installing: prerender through serverRouterPlugin from lit-ui-router-ssr/vite, which preloads both, load lit-ui-router-ssr/register by dynamic import after the shim, or preload the shim with node --import.',
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
 * which `hydrateRoot()` reads before it touches the document.
 * {@link PrerenderOptions.dehydrate | `dehydrate`}, or a
 * {@link PrerenderOptions.payload | `payload`} hook, adds the resolved values
 * the page was drawn with, which `bootstrap()` adopts; the page's entry in
 * the result's `pages` reports the bytes they add and, from `dehydrate`, the
 * resolves left to re-run on the client. A `renderShell`
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
 * @throws an `Error` when both `dehydrate` and `payload` are supplied
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
    dehydrate: dehydrateOptions,
    payload,
    responses,
    origin = 'http://lit-ui-router-ssr',
    ...site
  } = options;

  if (dehydrateOptions && payload)
    throw new Error(
      'prerender: pass `dehydrate` or `payload`, not both; a `payload` hook calls `dehydrate()` itself',
    );

  warnUnregistered();

  const draw = (
    transition: Transition,
    context: RenderContext,
  ): Partial<DehydrateResult> => {
    if (dehydrateOptions) return dehydrateLanded(transition, dehydrateOptions);

    return { payload: payload?.(transition, context) };
  };

  const drawLanded = (context: RenderContext): Partial<DehydrateResult> => {
    if (!dehydrateOptions && !payload) return {};

    // SAFETY: `peekTail()` is typed `Transition` and returns `undefined` on an empty queue.
    const landed = router.globals.successfulTransitions.peekTail() as
      | Transition
      | undefined;

    return landed ? draw(landed, context) : {};
  };

  const reports = new Map<string, PagePayload>();

  const renderTemplate = (
    body: TemplateResult,
    context: RenderContext,
  ): string => {
    const { payload: drawn, unserializable } = drawLanded(context);

    if (drawn) {
      const bytes = payloadBytes(router, drawn);

      reports.set(
        context.file,
        unserializable ? { bytes, unserializable } : { bytes },
      );
    }

    return renderPage(body, router, root, elementRenderers, drawn);
  };

  const renderLit = async (
    verdict: ShellVerdict,
    siteContext: SiteRenderContext,
  ): Promise<string> => {
    const context: RenderContext = { ...siteContext, root };
    const body = await renderShell(verdict, context);

    const markup = isString(body) ? body : renderTemplate(body, context);

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

    const pages = result.pages.map((page): PrerenderedPage => {
      const report = reports.get(page.file);

      return report ? { ...page, payload: report } : page;
    });

    return { ...result, pages, root };
  } finally {
    uninstall();
  }
}
