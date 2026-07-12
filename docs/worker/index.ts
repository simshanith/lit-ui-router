import { mounts } from 'sample-app-routes';
import { createServerRouter } from 'ui-router-server';

interface Env {
  ASSETS: Fetcher;
}

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
      return new Response(shell.body, {
        status: verdict.status ?? shell.status,
        headers,
      });
    }
    if (verdict.kind === 'redirect') {
      // The verdict's location may carry its own query, so the request's
      // params MERGE into it (the verdict's win); never concatenate.
      const location = new URL(verdict.location, url);
      for (const [key, value] of url.searchParams) {
        if (!location.searchParams.has(key))
          location.searchParams.append(key, value);
      }
      return new Response(null, {
        status: verdict.status,
        headers: { Location: location.pathname + location.search },
      });
    }
    // notFound: fall through to the assets binding's 404.html handling.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
