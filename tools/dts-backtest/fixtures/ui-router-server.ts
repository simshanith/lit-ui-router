import type { StateDeclaration } from '@uirouter/core';
import type { MiddlewareHandler } from 'hono';
import {
  createServerRouter,
  mergeSearch,
  type MountConfig,
  type RedirectRule,
  type RouteDeclaration,
  type ServerRouter,
  type Verdict,
} from 'ui-router-server';
import {
  createConnectMiddleware,
  type ConnectAdapterOptions,
  type ConnectMiddleware,
} from 'ui-router-server/connect';
import {
  createFetchHandler,
  type FetchAdapterOptions,
  type FetchHandler,
} from 'ui-router-server/fetch';
import { serverRouterHono } from 'ui-router-server/hono';
import {
  compare,
  exec,
  format,
  urlMatcherFactory,
  type CompiledMatcher,
  type UrlMatcherCompilerConfig,
} from 'ui-router-server/matcher';
import {
  compileRedirects,
  compileRoutes,
  evaluateRedirects,
  matchRoute,
  type CompiledRoute,
  type RedirectTable,
  type RouteMatch,
} from 'ui-router-server/redirects';
import { createHeadlessRouter, onceSettled } from 'ui-router-server/simulate';
import {
  serverRouterPlugin,
  type ServerRouterPlugin,
} from 'ui-router-server/vite';

const routes: RouteDeclaration[] = [
  { name: 'app', url: '' },
  { name: 'app.contacts', url: '/contacts' },
  {
    name: 'app.contacts.detail',
    url: '/{id}',
    params: { id: { squash: false } },
  },
  { name: 'app.legacy', url: '/people', redirectTo: 'app.contacts' },
  { name: 'app.notFound' },
];

const rules: RedirectRule[] = [
  { pattern: '/old/{id}', to: { state: 'app.contacts.detail' } },
  { pattern: /^\/archive\//, to: 'app.contacts' },
];

const matcherConfig: UrlMatcherCompilerConfig = {
  strict: false,
  caseInsensitive: true,
  decodeParams: true,
  defaultSquashPolicy: false,
};

const mount: MountConfig = {
  routes,
  redirects: rules,
  strategy: 'matcher',
  config: matcherConfig,
  otherwise: { state: 'app.notFound' },
};

const router: ServerRouter = createServerRouter({
  mounts: { '/app': mount, '/admin': { routes, strategy: 'simulate' } },
});

// The verdict union must stay exhaustively narrowable by `kind` — the whole
// point of the package's HTTP-honesty contract.
export async function statusFor(pathname: string): Promise<number> {
  const verdict: Verdict = await router.resolve(pathname);
  if (verdict.kind === 'redirect') {
    void mergeSearch(verdict.location, '?ref=nav');
    void verdict.mount;
    return verdict.status;
  }
  if (verdict.kind === 'shell') {
    void verdict.mount;
    return verdict.status ?? 200;
  }
  // `notFound` is the only arm whose `mount` is optional.
  void verdict.mount?.length;
  return 404;
}

// Matcher tier: the meta type parameter must flow through compile -> matcher.
const { compile } = urlMatcherFactory(matcherConfig);
const detail: CompiledMatcher<{ routeId: number }> = compile('/contacts/{id}', {
  params: { id: 'default' },
  meta: { routeId: 7 },
});

export function matcherRoundTrip(path: string): string | null {
  const params = exec(detail, path);
  if (params === null) return null;
  void detail.meta.routeId;
  void compare(detail, compile('/contacts/new'));
  return format(detail, params);
}

// Redirect tier: data-only, no router instance.
const table: RedirectTable = { routes, rules, config: matcherConfig };
const compiled: CompiledRoute[] = compileRoutes(routes, matcherConfig);
const evaluate: (pathname: string) => string | null = compileRedirects(table);

export function redirectFor(pathname: string): string | null {
  const match: RouteMatch | null = matchRoute(compiled, pathname);
  void match?.state;
  void match?.params;
  return evaluate(pathname) ?? evaluateRedirects(table, pathname);
}

// Simulate tier: the headless core router.
export async function simulate(states: StateDeclaration[]): Promise<boolean> {
  return onceSettled(createHeadlessRouter(states));
}

// Adapters. Each options bag is spelled out so a widened/narrowed callback
// signature surfaces here rather than at a consumer's build.
const connectOptions: ConnectAdapterOptions = {
  shellPath: (mountBase) => `${mountBase}/index.html`,
  serveShell: (_mountBase, req, _res, next) => {
    req.url = '/index.html';
    next();
  },
  serveNotFound: (_mountBase, _req, res, _next) => {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  },
  shouldHandle: (req) => req.method === 'GET',
};

export const middleware: ConnectMiddleware = createConnectMiddleware(
  router,
  connectOptions,
);

const fetchOptions: FetchAdapterOptions = {
  shellPath: (mountBase) => mountBase,
  serveShell: (_mountBase, request) => new Response(request.url),
  // Promise-returning on purpose: the option's union accepts both arms.
  serveNotFound: (_mountBase, _request) =>
    Promise.resolve(new Response('not found', { status: 404 })),
  shouldHandle: (request) => request.method === 'GET',
};

export const handler: FetchHandler = createFetchHandler(router, fetchOptions);

export const honoMiddleware: MiddlewareHandler = serverRouterHono(
  router,
  fetchOptions,
);

export const plugin: ServerRouterPlugin = serverRouterPlugin(
  router,
  connectOptions,
);
