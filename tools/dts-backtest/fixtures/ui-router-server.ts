import type { StateDeclaration, UIRouter } from '@uirouter/core';
import type { MiddlewareHandler } from 'hono';
import {
  createServerRouter,
  diagnoseMounts,
  mergeSearch,
  type MountConfig,
  type MountDiagnostic,
  type MountDiagnosticKind,
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
  installServerLocation,
  ServerLocationConfig,
  serverLocationPlugin,
  type ServerLocationOptions,
  type ServerLocationPluginOptions,
} from 'ui-router-server/location';
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
  applyUrlConfig,
  type RouterUrlConfig,
} from 'ui-router-server/url-config';
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

const urlConfig: RouterUrlConfig = {
  strict: false,
  caseInsensitive: true,
  defaultSquashPolicy: '~',
};

// A mount's config is the router-wide options plus decodeParams.
const matcherConfig: UrlMatcherCompilerConfig = {
  ...urlConfig,
  decodeParams: true,
};

const mount: MountConfig = {
  routes,
  redirects: rules,
  strategy: 'matcher',
  config: matcherConfig,
  otherwise: { state: 'app.notFound' },
};

const router: ServerRouter = createServerRouter({
  mounts: {
    '/app': mount,
    '/admin': { routes, strategy: 'simulate', prewarm: 1 },
  },
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

// Diagnostics take the table createServerRouter takes.
export function diagnosticLines(): string[] {
  const diagnostics: MountDiagnostic[] = diagnoseMounts({ '/app': mount });

  return diagnostics.map(({ kind, mount: base, message }) => {
    const code: MountDiagnosticKind = kind;

    return `${code} ${base}: ${message}`;
  });
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

// Location tier: the memory location a server render installs, in either shape.
// A mount's config passes as the location's urlConfig unchanged.
const locationOptions: ServerLocationOptions = {
  url: '/app/contacts',
  baseHref: '/app/',
  urlConfig: matcherConfig,
  html5Mode: true,
};

export function serverHref(
  router: UIRouter,
  states: StateDeclaration[],
): string {
  // A fresh router: the location and its url config go in before any state.
  const located = installServerLocation(router, locationOptions);
  states.forEach((state) => located.stateRegistry.register(state));
  void new ServerLocationConfig(undefined, false).html5Mode();
  void serverLocationPlugin;

  return located.stateService.href('app.contacts');
}

// Url-config tier: one config object for a mount and any core router; the
// router comes back at the type it went in as.
export function sharedUrlConfig(router: UIRouter): UIRouter {
  return applyUrlConfig(router, matcherConfig);
}

const hashLocationOptions: ServerLocationPluginOptions = { html5Mode: false };

export function serverHashHref(states: StateDeclaration[]): string {
  const headless = createHeadlessRouter(states);

  return installServerLocation(headless, hashLocationOptions).stateService.href(
    'app.contacts',
  );
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
