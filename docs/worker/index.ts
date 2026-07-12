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
      // Status precedence per the Verdict contract: absent means default
      // shell handling (304s included); explicit (future data tier) wins.
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
