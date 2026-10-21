// The /gh mount's verdicts as responses: a page rendered with lit-ui-router-ssr, a redirect, or a 404.
import { Rejection } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router/pure';
import 'lit-ui-router-ssr/register';
import { prerender, settle } from 'lit-ui-router-ssr';
import { createServerRouter, mergeSearch } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';

import { type PageHead, releaseDocument } from './document.ts';
import { type LedgerReader, NotInLedger } from './ledger.ts';
import { GH_MOUNT, ghMount, urlConfig } from './routes.ts';
import { releaseStates } from './states.ts';
import { rootView, unavailableView } from './views.ts';

export const resolver = createServerRouter({ mounts: { [GH_MOUNT]: ghMount } });

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

type Outcome =
  | { kind: 'page'; status: number; head: PageHead }
  | { kind: 'redirect'; location: string };

const UNAVAILABLE: PageHead = {
  title: 'Releases are unavailable',
  description: 'The release ledger could not be read.',
};

const routerFor = (ledger: LedgerReader): UIRouterLit => {
  const router = installServerLocation(new UIRouterLit(), {
    baseHref: `${GH_MOUNT}/`,
    urlConfig,
  });

  for (const state of releaseStates(ledger))
    router.stateRegistry.register(state);
  router.urlService.rules.otherwise({ state: 'notFound' });
  // settle() reports every failure; the default handler would log each 404.
  router.stateService.defaultErrorHandler(() => {});

  return router;
};

/** Renders one shell verdict's page, or names the redirect its transition took. */
const render = async (
  url: URL,
  ledger: LedgerReader,
): Promise<{ outcome: Outcome; html: string }> => {
  const router = routerFor(ledger);
  let outcome: Outcome = { kind: 'page', status: 200, head: UNAVAILABLE };
  let html = '';

  await prerender({
    resolver,
    router,
    paths: [url.pathname],
    outDir: '',
    rules: 'none',
    notFound: false,
    write: (_file, body) => {
      html = body;
    },
    renderShell: async (verdict, { subpath }) => {
      try {
        await settle(router, subpath);
      } catch (error) {
        if (!(error instanceof Error && isNotInLedger(error))) {
          outcome = { kind: 'page', status: 503, head: UNAVAILABLE };

          return unavailableView();
        }

        await router.stateService.go('notFound', {}, { location: false });
      }

      if (router.urlService.url() !== subpath)
        outcome = {
          kind: 'redirect',
          location: slashed(
            router.stateService.href(
              router.globals.current,
              router.globals.params,
            ),
          ),
        };
      else
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

/** Serves a /gh request, or returns null for a path the mount doesn't own. */
export const serveReleases = async (
  request: Request,
  ledger: LedgerReader,
): Promise<Response | null> => {
  const url = new URL(request.url);
  const verdict = await resolver.resolve(url);

  if (verdict.kind === 'notFound' && verdict.mount === undefined) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD')
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });

  if (verdict.kind === 'redirect')
    return redirect(slashed(verdict.location), verdict.status, url);

  const isPage = verdict.kind === 'shell' && verdict.status === undefined;

  if (
    isPage &&
    !url.pathname.endsWith('/') &&
    !url.pathname.endsWith('/latest')
  )
    return redirect(`${url.pathname}/`, 308, url);

  const { outcome, html } = await render(url, ledger);

  if (outcome.kind === 'redirect') return redirect(outcome.location, 302, url);

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
  headers.set('Cache-Control', cacheControl(outcome.status));

  return new Response(request.method === 'HEAD' ? null : html, {
    status: outcome.status,
    headers,
  });
};
