import { matchesAppRoute } from 'sample-app-routes/matchers.js';

// Longest mount first: '/app' is a prefix of '/app-mobx'.
const MOUNTS = ['/app-mobx', '/app'];

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    const mount = MOUNTS.find((prefix) => pathname.startsWith(`${prefix}/`));
    // Non-route paths under a mount fall through to assets' 404 handling.
    if (!mount || !matchesAppRoute(pathname.slice(mount.length))) {
      return env.ASSETS.fetch(request);
    }
    const shell = await env.ASSETS.fetch(
      new Request(new URL(mount, request.url), request),
    );
    const headers = new Headers(shell.headers);
    headers.set('Link', `<${mount}>; rel="canonical"`);
    return new Response(shell.body, { status: shell.status, headers });
  },
} satisfies ExportedHandler<Env>;
