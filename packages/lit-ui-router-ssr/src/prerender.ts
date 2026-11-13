// provideRouter() on a render root for the run, render.ts's lit render inside ui-router-server's prerender loop.
import type { RenderInfo } from '@lit-labs/ssr';
import type { TemplateResult } from 'lit';
import type { Transition } from '@uirouter/core';
import type { UIRouterLit } from 'lit-ui-router';
import { provideRouter } from 'lit-ui-router/context';
import { isString } from '@uirouter/core';
import type { Verdict } from 'ui-router-server';
import {
  prerender as prerenderSite,
  withBase,
} from 'ui-router-server/prerender';
import type {
  EmittedPage,
  FileWriter,
  PathReport,
  PrerenderOptions as SitePrerenderOptions,
  PrerenderResult as SitePrerenderResult,
  RenderContext as SiteRenderContext,
  RenderedRedirect,
} from 'ui-router-server/prerender';
import {
  dehydrate as dehydrateLanded,
  redirectedTo,
  settle,
} from 'ui-router-server/ssr';
import type {
  DehydrateOptions,
  DehydrateResult,
  ResolvePayload,
} from 'ui-router-server/ssr';

import {
  defaultElementRenderers,
  renderDrawn,
  warnUnregistered,
} from './render.js';
import type { PagePayload } from './render.js';
import { responder } from './respond.js';
import type { BoundResponses } from './respond.js';

export type {
  EmittedPage,
  FileWriter,
  PathReport,
  PrerenderTally,
  RedirectLine,
  RenderedRedirect,
} from 'ui-router-server/prerender';

export type { PagePayload } from './render.js';

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

const trimmed = (path: string): string => path.replace(/\/+$/, '');

const pathOf = (url: string): string => url.replace(/[?#].*$/, '');

// The router's hrefs are its baseHref plus its url, so after a settle they must spell the page's served path.
const placement = (router: UIRouterLit, base: string, path: string) => {
  const url = pathOf(router.urlService.url());
  const linked = `${trimmed(router.urlService.config.baseHref())}${url}`;
  const served = `${trimmed(base)}${pathOf(path)}`;

  return { url, linked, served, at: trimmed(linked) === trimmed(served) };
};

const checkSettled = (
  router: UIRouterLit,
  base: string,
  path: string,
): void => {
  const { url, linked, served, at } = placement(router, base, path);

  if (at) return;

  const suggested = served.endsWith(url)
    ? `${trimmed(served.slice(0, served.length - url.length))}/`
    : undefined;

  throw new Error(
    `prerender: the router settled '${path}' at '${linked}', but the page is served at '${served}'; build the router with installServerLocation(router, { baseHref: ${suggested === undefined ? 'site.base' : `'${suggested}'`} })`,
  );
};

/** What the trace adds to a path's report: where its render landed and what it dehydrated. */
interface Landing {
  state?: string;
  tokens?: string[];
}

const tokensOf = ({ resolves }: ResolvePayload): string[] =>
  Object.entries(resolves).flatMap(([state, tokens]) =>
    Object.keys(tokens).map((token) => `${state}.${token}`),
  );

// The report's target is base-free; the line names it as the host serves it, and says so when the base changed it.
const servedTarget = (base: string, location: string): string => {
  const served = withBase(`${trimmed(base)}/`, location);

  return served === location
    ? `'${location}'`
    : `'${served}' (with base '${trimmed(base)}/')`;
};

// One line per path under core's `TRANSITION` trace, in core's `console.log` style.
const tracePath = (
  router: UIRouterLit,
  base: string,
  { path, verdict, redirect }: PathReport,
  { state, tokens }: Landing,
): void => {
  if (!router.trace.enabled('TRANSITION')) return;
  console.log(
    `prerender: '${path}' ${verdict.kind}` +
      (state === undefined ? '' : `, landed '${state}'`) +
      (redirect
        ? `, redirect ${redirect.status} ${servedTarget(base, redirect.location)}`
        : '') +
      (tokens?.length ? `, dehydrated [${tokens.join(', ')}]` : ''),
  );
};

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

/** A `renderShell` hook that settles `router` on the path and returns `template(router)`. */
const settledTemplate =
  (router: UIRouterLit, template: (router: UIRouterLit) => TemplateResult) =>
  async (
    verdict: ShellVerdict,
    { path }: SiteRenderContext,
  ): Promise<TemplateResult> => {
    try {
      await settle(router, path);
    } catch (cause) {
      if (verdict.status !== 404) throw cause;

      // SAFETY: `settle` rejects with an `Error` only.
      const { message } = cause as Error;

      throw new Error(
        `prerender: \`template\` settles the router on '${path}', which its mount answers from the otherwise projection, and the settle failed, usually because the router declares no \`otherwise\` rule of its own (${message})`,
        { cause },
      );
    }

    return template(router);
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
   * The page's template, read from {@link PrerenderOptions.router | router}
   * once it stands on the path: for each shell verdict, `router` is settled
   * on the path with `settle` from `ui-router-server/ssr` and the template
   * this returns is rendered, as a {@link PrerenderOptions.renderShell | renderShell}
   * hook that settles and returns `template(router)` would. Pass this or
   * `renderShell`, not both. The 404 document's probe path is settled too, so
   * a mount that projects an `otherwise` needs the router to declare an
   * `otherwise` rule of its own, or the render rejects.
   */
  template?: (router: UIRouterLit) => TemplateResult;
  /**
   * Renders one shell verdict, in place of
   * {@link PrerenderOptions.template | template}, for a page that needs the
   * verdict or more than a settle. Return a template and this package renders it,
   * behind the hydration signature; return a string and it is written as-is.
   * Async, so a hook may drive {@link PrerenderOptions.router | router} to the
   * path before it returns. When the transition the router lands on during
   * the hook was redirected, by a `redirectTo` function for one, the path
   * gets a rules line to where it landed, at the redirecting state's
   * `redirectStatusCode`, and no page: `redirectedTo` from
   * `ui-router-server/ssr` reports it.
   */
  renderShell?: (
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
   * `<ui-view>` to fill. A shadow-DOM `LitElement` no renderer in the list
   * answers for renders as its bare tag, empty, and warns once per tag in
   * development; pass `shadowElementRenderers`, which adds `LitElementRenderer`
   * after `LightElementRenderer`, to draw it.
   */
  elementRenderers?: RenderInfo['elementRenderers'];
  /**
   * Handlers for the router's response states, keyed by state name, as
   * {@link responder} takes them. A path that matches one settles
   * {@link PrerenderOptions.router | router} on it and writes what its
   * handler answers: a 2xx body at the path its url spells, or a 3xx as a
   * rules line. The handler's request is a GET for the path under
   * {@link PrerenderOptions.base | base} at
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
   * router last landed, once `template` or `renderShell` has returned a
   * template. The payload's `resolves` go into the page's hydration signature, beside the
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
   * ```ts nocheck
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
   * router last landed, once `template` or `renderShell` has returned a
   * template, it returns the payload the page's signature carries, or
   * `undefined` to write none.
   * Passing both this and `dehydrate` throws.
   *
   * @example
   * Shape the payload `dehydrate` draws before it is written:
   * ```ts nocheck
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

/**
 * Emits a static site from a mount table's verdicts: a shell verdict becomes
 * `<subpath>/index.html`, or a rules line when the transition its render
 * landed, through `template` or `renderShell`, was redirected, a response
 * state becomes the body or rules line its
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
 * package's version, the state and parameter values the router stood on, and
 * the fully qualified name of each `<ui-view>` it drew a routed component
 * into, which `hydrateRoot()` reads before it touches the document and
 * `bootstrap()` reports each view's outcome against.
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
 * @throws an `Error` when both `template` and `renderShell` are supplied, or neither
 * @throws an `Error` when a render settles the router where its links don't spell the page's served path: `baseHref()` plus its url, against `base` plus the path
 *
 * @example
 * ```ts
 * import type { TemplateResult } from 'lit';
 * import type { UIRouterLit } from 'lit-ui-router';
 * import { prerender, type PrerenderOptions } from 'lit-ui-router-ssr';
 *
 * declare const mounts: PrerenderOptions['mounts'];
 * declare const router: UIRouterLit;
 * declare const titles: Map<string, string>;
 * declare function page(router: UIRouterLit): TemplateResult;
 * declare function fillShell(title: string | undefined, body: string): string;
 *
 * const result = await prerender({
 *   mounts,
 *   router,
 *   outDir: 'dist',
 *   paths: ['/', '/sheet/7B', '/legacy'],
 *   template: page,
 *   document: (body, { path }) => fillShell(titles.get(path), body),
 * });
 * ```
 */
export async function prerender(
  options: PrerenderOptions,
): Promise<PrerenderResult> {
  const {
    router,
    template,
    renderShell: shellHook,
    document,
    elementRenderers = defaultElementRenderers,
    root = new EventTarget(),
    write = nodeWrite,
    dehydrate: dehydrateOptions,
    payload,
    responses,
    origin = 'http://lit-ui-router-ssr',
    ...site
  } = options;

  const base = site.base ?? site.resolver?.base ?? '/';

  if (dehydrateOptions && payload)
    throw new Error(
      'prerender: pass `dehydrate` or `payload`, not both; a `payload` hook calls `dehydrate()` itself',
    );

  if (template && shellHook)
    throw new Error(
      'prerender: pass `template` or `renderShell`, not both; a `renderShell` hook settles the router itself',
    );

  const renderShell =
    shellHook ?? (template && settledTemplate(router, template));

  if (!renderShell)
    throw new Error('prerender: pass `template` or `renderShell`');

  warnUnregistered();

  const draw = (
    transition: Transition,
    context: RenderContext,
  ): Partial<DehydrateResult> => {
    if (dehydrateOptions) return dehydrateLanded(transition, dehydrateOptions);

    return { payload: payload?.(transition, context) };
  };

  // `peekTail()` is typed `Transition` and returns `undefined` on an empty queue.
  const lastLanded = (): Transition | undefined =>
    router.globals.successfulTransitions.peekTail();

  const drawLanded = (context: RenderContext): Partial<DehydrateResult> => {
    if (!dehydrateOptions && !payload) return {};
    const landed = lastLanded();

    return landed ? draw(landed, context) : {};
  };

  // A transition this render landed, not one an earlier page left the router on.
  const redirectOf = (
    verdict: ShellVerdict,
    before: Transition | undefined,
  ): RenderedRedirect | undefined => {
    const landed = lastLanded();

    const redirect =
      landed && landed !== before ? redirectedTo(router, landed) : undefined;

    if (!redirect) return undefined;
    const { mount } = verdict;

    return {
      location: mount === '/' ? redirect.url || '/' : mount + redirect.url,
      status: redirect.status,
    };
  };

  const reports = new Map<string, PagePayload>();

  // The path being handled; renders run one at a time, and `onPath` follows each.
  let landing: Landing = {};

  const renderTemplate = (
    body: TemplateResult,
    context: RenderContext,
  ): string => {
    const drawn = drawLanded(context);

    if (drawn.payload) landing.tokens = tokensOf(drawn.payload);

    const page = renderDrawn(body, router, root, elementRenderers, drawn);

    if (page.payload) reports.set(context.file, page.payload);

    return page.html;
  };

  const renderLit = async (
    verdict: ShellVerdict,
    siteContext: SiteRenderContext,
  ): Promise<string | RenderedRedirect> => {
    const context: RenderContext = { ...siteContext, root };
    const before = lastLanded();
    const body = await renderShell(verdict, context);
    const landed = lastLanded();

    // A path the router already stands on settles on the transition that put it there.
    if (
      landed &&
      (landed !== before || placement(router, base, context.path).at)
    )
      landing.state = landed.$to().name;

    const redirect = redirectOf(verdict, before);

    if (redirect) return redirect;

    if (lastLanded() !== before) checkSettled(router, base, context.path);

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

      landing.state = verdict.state;

      return responder(router, responses)(
        verdict,
        new Request(new URL(`${base.replace(/\/+$/, '')}${path}`, origin)),
      );
    };

    const onPath = (report: PathReport): void => {
      tracePath(router, base, report, landing);
      landing = {};
      site.onPath?.(report);
    };

    const result = await prerenderSite({
      ...site,
      render: renderLit,
      respond,
      write,
      onPath,
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
