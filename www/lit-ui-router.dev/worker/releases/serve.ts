// The /releases and /gh verdicts as responses: a page rendered with lit-ui-router-ssr, a response state's answer, a redirect, or a 404.
import { Rejection } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import 'lit-ui-router-ssr/register';
import { prerender, responder, settle } from 'lit-ui-router-ssr';
import { createServerRouter, mergeSearch } from 'ui-router-server';
import type { ServerRouter, Verdict } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';

import { type PageHead, releaseDocument } from './document.ts';
import { type Answer, cached, type EdgeCache } from './edge-cache.ts';
import { type LedgerReader, NotInLedger } from './ledger.ts';
import { mounts, urlConfig } from './routes.ts';
import {
  type ReleaseState,
  releaseResponses,
  releaseStates,
} from './states.ts';
import { rootView, unavailableView } from './views.ts';

export const resolver = createServerRouter({ mounts });

const slashed = (path: string): string =>
  path.endsWith('/') ? path : `${path}/`;

const isNotInLedger = (error: Error): boolean =>
  error.cause instanceof Rejection && error.cause.detail instanceof NotInLedger;

const headOf = (router: UIRouterLit): PageHead => {
  const { current, params } = router.globals;
  const pkg = String(params.pkg);
  const version = String(params.version);

  if (current.name === 'releases.package.version')
    return {
      title: `${pkg}@${version}`,
      description: `The ${pkg}@${version} release: its npm publish, git tag and GitHub release.`,
    };

  if (current.name === 'releases.package')
    return {
      title: `${pkg} releases`,
      description: `Every ${pkg} release, newest first, linking to each GitHub release.`,
    };

  if (current.name === 'releases')
    return {
      title: 'Releases',
      description: 'The latest stable release of every lit-ui-router package.',
    };

  return {
    title: 'Not found',
    description: 'No release lives at this address.',
  };
};

type PageVerdict = Extract<Verdict, { kind: 'shell' }>;

type ResponseVerdict = Extract<Verdict, { kind: 'response' }>;

interface Page {
  status: number;
  head: PageHead;
}

const UNAVAILABLE: PageHead = {
  title: 'Releases are unavailable',
  description: 'The release ledger could not be read.',
};

/** One request's page router at `mount`, and its states by name. */
const routerFor = (mount: string, ledger: LedgerReader) => {
  const router = installServerLocation(new UIRouterLit(), {
    baseHref: `${mount}/`,
    urlConfig,
  });

  const states = new Map<string, ReleaseState>();

  for (const state of releaseStates(mount, ledger)) {
    router.stateRegistry.register(state);
    states.set(state.name, state);
  }

  router.urlService.rules.otherwise({ state: 'notFound' });
  // settle() reports every failure; the default handler would log each 404.
  router.stateService.defaultErrorHandler(() => {});

  return { router, states };
};

type PageRouter = ReturnType<typeof routerFor>;

/** Renders one shell verdict's page; `failure` is a response state's failed settle, rendered as the page it means. */
const render = async (
  request: Request,
  { router }: PageRouter,
  verdict: PageVerdict,
  failure?: Error,
): Promise<{ page: Page; html: string }> => {
  let page: Page = { status: 200, head: UNAVAILABLE };
  let html = '';
  // serveReleases already holds the verdict, so the loop resolves nothing again.
  const decided: ServerRouter = { resolve: () => Promise.resolve(verdict) };

  await prerender({
    resolver: decided,
    router,
    paths: [new URL(request.url).pathname],
    outDir: '',
    rules: 'none',
    notFound: false,
    write: (_file, body) => {
      html = body;
    },
    renderShell: async (_verdict, { subpath }) => {
      try {
        if (failure) throw failure;
        await settle(router, subpath);
      } catch (error) {
        if (!(error instanceof Error && isNotInLedger(error))) {
          page = { status: 503, head: UNAVAILABLE };

          return unavailableView();
        }

        await router.stateService.go('notFound', {}, { location: false });
      }

      page = {
        status:
          router.globals.current.name === 'notFound'
            ? 404
            : (verdict.status ?? 200),
        head: headOf(router),
      };

      return rootView(router);
    },
    document: (body) => releaseDocument(body, page.head),
  });

  return { page, html };
};

const redirect = (location: string, status: number, url: URL): Response =>
  new Response(null, {
    status,
    headers: { Location: mergeSearch(location, url.search) },
  });

// Pages and misses may be cached briefly; an outage never is.
const cacheControl = (status: number): string =>
  status === 503 ? 'no-store' : 'public, max-age=300';

const withoutBody = (response: Response): Response =>
  new Response(null, { status: response.status, headers: response.headers });

/** A response state's answer, or the page its failure means. */
const respond = async (
  request: Request,
  pageRouter: PageRouter,
  verdict: ResponseVerdict,
): Promise<Response | Error> => {
  try {
    // As a GET, so the edge keeps a body; serveReleases drops it for a HEAD.
    return await responder(pageRouter.router, releaseResponses)(
      verdict,
      new Request(request, { method: 'GET' }),
    );
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
};

const htmlAnswer = async (
  request: Request,
  pageRouter: PageRouter,
  verdict: PageVerdict,
  failure?: Error,
): Promise<Answer> => {
  const { page, html } = await render(request, pageRouter, verdict, failure);
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
  headers.set('Cache-Control', cacheControl(page.status));

  return {
    response: new Response(html, { status: page.status, headers }),
    cacheable: false,
  };
};

/** A response state's answer, which the edge may keep, or the page the transition rendered, which it may not. */
const answer = async (
  request: Request,
  pageRouter: PageRouter,
  verdict: PageVerdict | ResponseVerdict,
): Promise<Answer> => {
  if (verdict.kind === 'shell') return htmlAnswer(request, pageRouter, verdict);

  const answered = await respond(request, pageRouter, verdict);

  return answered instanceof Error
    ? htmlAnswer(
        request,
        pageRouter,
        { kind: 'shell', mount: verdict.mount },
        answered,
      )
    : { response: answered, cacheable: true };
};

// A page lives at the slashed spelling; a response state keeps the url it was asked for.
const wantsSlash = (
  verdict: PageVerdict | ResponseVerdict,
  url: URL,
): boolean =>
  verdict.kind === 'shell' &&
  verdict.status === undefined &&
  !url.pathname.endsWith('/');

const cacheKeyOf = (
  { states }: PageRouter,
  verdict: PageVerdict | ResponseVerdict,
  request: Request,
): Request | undefined =>
  verdict.kind === 'response'
    ? states.get(verdict.state)?.cacheKey?.(request)
    : undefined;

/** Serves a /releases or /gh request, or returns null for a path neither mount owns; `edge` caches the states that name a key. */
export const serveReleases = async (
  request: Request,
  ledger: LedgerReader,
  edge?: EdgeCache,
): Promise<Response | null> => {
  const url = new URL(request.url);
  const verdict = await resolver.resolve(url);
  const { mount } = verdict;

  if (mount === undefined) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });

  if (verdict.kind === 'redirect')
    return redirect(slashed(verdict.location), verdict.status, url);

  // Both mounts project otherwise and name no delegates, so only pages and response states remain.
  if (verdict.kind !== 'shell' && verdict.kind !== 'response') return null;

  if (wantsSlash(verdict, url)) return redirect(`${url.pathname}/`, 308, url);

  const pageRouter = routerFor(mount, ledger);
  const fresh = () => answer(request, pageRouter, verdict);

  const key = cacheKeyOf(pageRouter, verdict, request);

  const response =
    edge === undefined || key === undefined
      ? (await fresh()).response
      : await cached(edge, key, fresh);

  return request.method === 'HEAD' ? withoutBody(response) : response;
};
