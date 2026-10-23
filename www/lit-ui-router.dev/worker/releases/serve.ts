// The /releases and /gh verdicts as responses: a page rendered with lit-ui-router-ssr, a response state's answer, a redirect, or a 404.
import { Rejection } from '@uirouter/core';
import type { StateRule, Transition } from '@uirouter/core';
import { UIRouterLit, type UIViewResolves } from 'lit-ui-router/pure';
import 'lit-ui-router-ssr/register';
import { prerender, settle } from 'lit-ui-router-ssr';
import { createServerRouter, mergeSearch } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';

import type { DiffSource } from './diff-data.ts';
import { DIFF_SCRIPT, type PageHead, releaseDocument } from './document.ts';
import { type Answer, cached, type EdgeCache } from './edge-cache.ts';
import { type LedgerReader, NotInLedger } from './ledger.ts';
import { mounts, urlConfig } from './routes.ts';
import { type ReleaseState, releaseStates } from './states.ts';
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

  if (current.name === 'releases.package.compare') {
    const [from, to] = [String(params.from), String(params.to)];

    return {
      title: `${pkg} ${from}...${to}`,
      description: `What changed in the files ${pkg} published to npm between ${from} and ${to}.`,
      script: DIFF_SCRIPT,
    };
  }

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

type Outcome =
  | { kind: 'page'; status: number; head: PageHead }
  | { kind: 'response'; response: Response };

const UNAVAILABLE: PageHead = {
  title: 'Releases are unavailable',
  description: 'The release ledger could not be read.',
};

/** One request's page router at `mount`, and its states by name. */
const routerFor = (mount: string, ledger: LedgerReader, diffs: DiffSource) => {
  const router = installServerLocation(new UIRouterLit(), {
    baseHref: `${mount}/`,
    urlConfig,
  });

  const states = new Map<string, ReleaseState>();

  for (const state of releaseStates(mount, ledger, diffs)) {
    router.stateRegistry.register(state);
    states.set(state.name, state);
  }

  router.urlService.rules.otherwise({ state: 'notFound' });
  // settle() reports every failure; the default handler would log each 404.
  router.stateService.defaultErrorHandler(() => {});

  return { router, states };
};

type PageRouter = ReturnType<typeof routerFor>;

/** The state the url rule for `subpath` names, without running a transition. */
const stateAt = (
  { router, states }: PageRouter,
  subpath: string,
): ReleaseState | undefined => {
  const best = router.urlService.match({ path: subpath, search: {}, hash: '' });

  // SAFETY: a `STATE` rule is core's `StateRule`.
  return best?.rule.type === 'STATE'
    ? states.get((best.rule as StateRule).state.name)
    : undefined;
};

const resolvesOf = (trans: Transition): UIViewResolves =>
  Object.fromEntries(
    trans
      .getResolveTokens()
      .filter((token): token is string => typeof token === 'string')
      .map((token) => [token, trans.injector().get<unknown>(token)]),
  );

/** Renders one shell verdict's page, or the answer of the response state its transition landed on. */
const render = async (
  request: Request,
  { router, states }: PageRouter,
): Promise<{ outcome: Outcome; html: string }> => {
  let outcome: Outcome = { kind: 'page', status: 200, head: UNAVAILABLE };
  let html = '';

  await prerender({
    resolver,
    router,
    paths: [new URL(request.url).pathname],
    outDir: '',
    rules: 'none',
    notFound: false,
    write: (_file, body) => {
      html = body;
    },
    renderShell: async (verdict, { subpath }) => {
      try {
        // prerender passes the path alone; response states read the search.
        const trans = await settle(
          router,
          subpath + new URL(request.url).search,
        );

        const respond = states.get(trans.$to().name)?.respond;

        if (respond) {
          outcome = {
            kind: 'response',
            response: respond({ resolves: resolvesOf(trans), request }),
          };

          return '';
        }
      } catch (error) {
        if (!(error instanceof Error && isNotInLedger(error))) {
          outcome = { kind: 'page', status: 503, head: UNAVAILABLE };

          return unavailableView();
        }

        await router.stateService.go('notFound', {}, { location: false });
      }

      outcome = {
        kind: 'page',
        status:
          router.globals.current.name === 'notFound'
            ? 404
            : (verdict.status ?? 200),
        head: headOf(router),
      };

      return rootView(router);
    },
    document: (body) =>
      outcome.kind === 'page' ? releaseDocument(body, outcome.head) : '',
  });

  return { outcome, html };
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

/** A response state's answer, which the edge may keep, or the page the transition rendered, which it may not. */
const answer = async (
  request: Request,
  pageRouter: PageRouter,
): Promise<Answer> => {
  const { outcome, html } = await render(request, pageRouter);

  if (outcome.kind === 'response')
    return { response: outcome.response, cacheable: true };

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
  headers.set('Cache-Control', cacheControl(outcome.status));

  return {
    response: new Response(html, { status: outcome.status, headers }),
    cacheable: false,
  };
};

/** Serves a /releases or /gh request, or returns null for a path neither mount owns; `edge` caches the states that name a key. */
export const serveReleases = async (
  request: Request,
  ledger: LedgerReader,
  diffs: DiffSource,
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

  const pageRouter = routerFor(mount, ledger, diffs);
  const state = stateAt(pageRouter, url.pathname.substring(mount.length));

  if (
    verdict.kind === 'shell' &&
    verdict.status === undefined &&
    !url.pathname.endsWith('/') &&
    state?.response !== true
  )
    return redirect(`${url.pathname}/`, 308, url);

  const fresh = () => answer(request, pageRouter);
  const key = state?.cacheKey?.(request);

  const response =
    edge === undefined || key === undefined
      ? (await fresh()).response
      : await cached(edge, key, fresh);

  return request.method === 'HEAD' ? withoutBody(response) : response;
};
