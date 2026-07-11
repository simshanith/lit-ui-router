import { matchesAppRoute } from 'sample-app-routes/matchers.js';
import { computeAppRedirect } from 'sample-app-routes/simulate.js';

interface Env {
  ASSETS: Fetcher;
}

// Longest mount first: '/app' is a prefix of '/app-mobx'.
const MOUNTS = ['/app-mobx', '/app'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const mount = MOUNTS.find((prefix) => pathname.startsWith(`${prefix}/`));
    // Non-route paths under a mount fall through to assets' 404 handling.
    if (!mount || !matchesAppRoute(pathname.slice(mount.length))) {
      return env.ASSETS.fetch(request);
    }
    // Entry redirects (e.g. '/' -> '/welcome') answer 302 instead of serving
    // the shell at a stale URL; the original query string is preserved
    // (projected targets are path-only, so appending url.search is safe).
    const redirect = await computeAppRedirect(pathname.slice(mount.length));
    if (redirect !== null) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${mount}${redirect}${url.search}` },
      });
    }
    const shell = await env.ASSETS.fetch(
      new Request(new URL(mount, request.url), request),
    );
    const headers = new Headers(shell.headers);
    headers.set('Link', `<${mount}>; rel="canonical"`);
    return new Response(shell.body, { status: shell.status, headers });
  },
} satisfies ExportedHandler<Env>;
