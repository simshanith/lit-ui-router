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
      const shellRequest = new Request(
        new URL(verdict.mount, request.url),
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
      const headers = new Headers(shell.headers);
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
      return new Response(null, {
        status: verdict.status,
        headers: { Location: mergeSearch(verdict.location, url.search) },
      });
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
