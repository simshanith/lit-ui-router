import { mounts } from 'sample-app-routes';
import { createServerRouter, mergeSearch } from 'ui-router-server';

// All routing intelligence lives in ui-router-server; the worker's one job
// is verdict -> HTTP. Module scope: the mount tables compile once per isolate.
const router = createServerRouter({ mounts });

// The 404-pattern exhibit mounts have no shell asset of their own — they
// serve the vanilla app's (its asset urls are absolute, so the shell works
// under any prefix). Mounts without an alias serve the shell at their base.
const SHELL_PATHS: Record<string, string> = { '/not-found-spa': '/app' };

// Every exhibit response carries noindex: the naive rung deliberately serves
// soft-404s, and the site must not be penalized by its own teaching material.
const EXHIBITS = new Set(['/not-found-naive', '/not-found-spa']);
const noindexed = (mount: string, headers: Headers): Headers => {
  if (EXHIBITS.has(mount)) headers.set('X-Robots-Tag', 'noindex');
  return headers;
};

// The not-found-naive exhibit: the classic SPA-host fallback — every path
// serves the shell at 200, no route matching at all (the soft-404
// anti-pattern baseline, and what this site itself shipped before this
// stack). It bypasses resolve() deliberately: the rung demonstrates the
// ABSENCE of server routing.
const NAIVE_MOUNT = '/not-found-naive';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === NAIVE_MOUNT ||
      url.pathname.startsWith(`${NAIVE_MOUNT}/`)
    ) {
      const shell = await env.ASSETS.fetch(
        new Request(new URL('/app', request.url), request),
      );
      return new Response(shell.body, {
        status: shell.status,
        headers: noindexed(NAIVE_MOUNT, new Headers(shell.headers)),
      });
    }
    const verdict = await router.resolve(url);
    if (verdict.kind === 'shell') {
      // Constructing the shell request from the original carries the
      // conditional headers along, so deep-link revalidations still 304.
      const shellRequest = new Request(
        new URL(SHELL_PATHS[verdict.mount] ?? verdict.mount, request.url),
        request,
      );
      // Status precedence per the Verdict contract: absent means default
      // shell handling, 304s included. An explicit status (404 via the
      // otherwise projection) wins outright, and the validators must go so
      // the fetch returns a 200 body to relabel — never a bare 304.
      if (verdict.status !== undefined) {
        shellRequest.headers.delete('If-None-Match');
        shellRequest.headers.delete('If-Modified-Since');
      }
      const shell = await env.ASSETS.fetch(shellRequest);
      const headers = noindexed(verdict.mount, new Headers(shell.headers));
      // No canonical Link on status'd shells: a 404 is not an alternate
      // representation of the mount root.
      if (verdict.status === undefined)
        headers.set('Link', `<${verdict.mount}>; rel="canonical"`);
      return new Response(shell.body, {
        status: verdict.status ?? shell.status,
        headers,
      });
    }
    if (verdict.kind === 'redirect') {
      const headers = new Headers({
        Location: mergeSearch(verdict.location, url.search),
      });
      return new Response(null, {
        status: verdict.status,
        headers: noindexed(verdict.mount, headers),
      });
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
