import { mounts } from 'sample-app-routes';
import { createServerRouter } from 'ui-router-server';
import { createFetchHandler } from 'ui-router-server/fetch';

// All routing intelligence lives in ui-router-server; the ./fetch adapter
// turns a verdict into an HTTP Response. Module scope: the mount tables
// compile once per isolate.
const router = createServerRouter({ mounts });

// The 404-pattern exhibit mounts have no shell asset of their own — they serve
// the vanilla app's (its asset urls are absolute, so the shell works under any
// prefix). Mounts without an alias serve the shell at their own base, which is
// the adapter's shellPath default.
const SHELL_PATHS: Record<string, string> = {
  '/not-found-spa': '/app',
  '/simulated-routing': '/app',
};

// Every exhibit response carries noindex: the naive rung deliberately serves
// soft-404s, and the site must not be penalized by its own teaching material.
// The generic adapter owns verdict -> HTTP; SEO policy stays the site's,
// layered on the adapter's OUTPUT — a redirect Response the adapter builds has
// no host hook, so noindex rides the request path, not a per-verdict callback.
const EXHIBITS = ['/not-found-naive', '/not-found-spa', '/simulated-routing'];
const isExhibit = (pathname: string): boolean =>
  EXHIBITS.some((m) => pathname === m || pathname.startsWith(`${m}/`));

const withNoindex = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, headers });
};

// The not-found-naive exhibit: the classic SPA-host fallback — every path
// serves the shell at 200, no route matching at all (the soft-404 anti-pattern
// baseline, and what this site shipped before this stack). It has no mounts
// entry BY DESIGN: the rung demonstrates the ABSENCE of server routing, so it
// bypasses the router entirely rather than riding a verdict.
const NAIVE_MOUNT = '/not-found-naive';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.pathname === NAIVE_MOUNT ||
      url.pathname.startsWith(`${NAIVE_MOUNT}/`)
    ) {
      // Construct the shell request from the original so its conditional
      // headers ride along and a repeat load can still 304.
      const shell = await env.ASSETS.fetch(
        new Request(new URL('/app', request.url), request),
      );
      return withNoindex(shell);
    }

    // The fetch adapter fronts every routed mount: it owns status mapping,
    // mergeSearch on redirect Locations, validator stripping + status relabel
    // on status'd shells, and the canonical Link header. The host supplies the
    // asset IO (env.ASSETS) and the two policies the adapter can't know: shell
    // aliasing (SHELL_PATHS) and the real 404 page.
    const handler = createFetchHandler(router, {
      shellPath: (mount) => SHELL_PATHS[mount] ?? mount,
      // The adapter hands over a shell Request already rewritten to shellPath
      // and (for a status'd shell) stripped of validators — the host's job is
      // the raw asset fetch; the adapter owns the relabel and Link on the way
      // out. Deep-link revalidations still 304: a non-status'd shell request
      // carries the conditional headers along from the original.
      serveShell: (_mount, shellRequest) => env.ASSETS.fetch(shellRequest),
      // Mount-owned miss: serve that app's 404 page re-wrapped at an honest
      // 404; anything but the page itself (or an asset with no 404.html) falls
      // through to the assets binding's own 404.html handling.
      serveNotFound: async (mount, req) => {
        const page = await env.ASSETS.fetch(
          new URL(`${mount}/404.html`, req.url),
        );
        return page.status === 200
          ? new Response(page.body, {
              status: 404,
              headers: new Headers(page.headers),
            })
          : env.ASSETS.fetch(request);
      },
      // The worker runs FIRST for the mount prefixes (wrangler
      // run_worker_first) and real assets live at /assets, never under a
      // mount — so it judges every request that reaches it, not just
      // navigations.
      shouldHandle: () => true,
    });

    const response = await handler(request);
    // null is the adapter's pass-through: a notFound without a mount (the path
    // isn't this router's), served however the assets binding would.
    if (response === null) return env.ASSETS.fetch(request);
    // Quarantine the teaching exhibits from crawlers, layered on the adapter's
    // output (the redirect Response it builds has no host hook of its own).
    return isExhibit(url.pathname) ? withNoindex(response) : response;
  },
} satisfies ExportedHandler<Env>;
