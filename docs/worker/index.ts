interface Env {
  ASSETS: Fetcher;
}

// Longest mount first: '/app' is a prefix of '/app-mobx'.
const MOUNTS = ['/app-mobx', '/app'];

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    const mount = MOUNTS.find((prefix) => pathname.startsWith(`${prefix}/`));
    if (!mount) {
      return env.ASSETS.fetch(request);
    }
    const shell = await env.ASSETS.fetch(new URL(mount, request.url));
    const headers = new Headers(shell.headers);
    headers.set('Link', `<${mount}>; rel="canonical"`);
    return new Response(shell.body, { status: shell.status, headers });
  },
} satisfies ExportedHandler<Env>;
