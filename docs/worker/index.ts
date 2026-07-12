import { mounts } from 'sample-app-routes';
import { createServerRouter, mergeSearch } from 'ui-router-server';

// All routing intelligence lives in ui-router-server; the worker's one job
// is verdict -> HTTP. Module scope: the mount tables compile once per isolate.
const router = createServerRouter({ mounts });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const verdict = await router.resolve(url);
    if (verdict.kind === 'shell') {
      // Constructing the shell request from the original carries the
      // conditional headers along, so deep-link revalidations still 304.
      const shell = await env.ASSETS.fetch(
        new Request(new URL(verdict.mount, request.url), request),
      );
      const headers = new Headers(shell.headers);
      headers.set('Link', `<${verdict.mount}>; rel="canonical"`);
      // Status precedence per the Verdict contract: absent (always, today)
      // means default shell handling, 304s included. When a data tier sets
      // an explicit status, this fetch must also strip the request's
      // validators so there is a 200 body to relabel — never a bare 304.
      return new Response(shell.body, {
        status: verdict.status ?? shell.status,
        headers,
      });
    }
    if (verdict.kind === 'redirect') {
      return new Response(null, {
        status: verdict.status,
        headers: { Location: mergeSearch(verdict.location, url.search) },
      });
    }
    // notFound with a mount: the mount owned the path but nothing matched,
    // so serve that app's 404 page re-wrapped with a real 404 status — never
    // a redirect, and no canonical Link header (it's not a route). The fresh
    // GET drops conditional headers, so the asset can't 304 into an empty
    // body; anything but the page itself falls through to default handling.
    if (verdict.mount) {
      const page = await env.ASSETS.fetch(
        new URL(`${verdict.mount}/404.html`, request.url),
      );
      if (page.status === 200) {
        return new Response(page.body, { status: 404, headers: page.headers });
      }
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
