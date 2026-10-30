import type { RawParams, StateDeclaration, UIRouter } from '@uirouter/core';
import { Hono } from 'hono';
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
  type ServerRouterDeclarations,
  type Verdict,
} from 'ui-router-server';
import {
  createConnectMiddleware,
  type ConnectAdapterOptions,
  type ConnectMiddleware,
} from 'ui-router-server/connect';
import {
  createFetchHandler,
  delegateContext,
  type DelegateContext,
  type DelegateHandler,
  type DelegateHandlers,
  type DelegateKey,
  type DelegateParams,
  type DelegateState,
  type FetchAdapterOptions,
  type FetchHandler,
  type RequiredDelegates,
} from 'ui-router-server/fetch';
import {
  delegateContext as honoDelegateContext,
  serverRouterHono,
  type HonoDelegateArgs,
} from 'ui-router-server/hono';
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
  prerender,
  type EmittedPage,
  type FileWriter,
  type PrerenderOptions,
  type PrerenderResult,
  type PrerenderTally,
  type RedirectLine,
  type RenderContext,
} from 'ui-router-server/prerender';
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
  dehydrate,
  settle,
  type DehydrateResult,
  type JsonValue,
  type SettleOptions,
} from 'ui-router-server/ssr';
import { seed, type ResolvePayload } from 'ui-router-server/ssr/client';
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
  { name: 'contactHelp', parent: 'app.contacts', url: '/help' },
  { name: 'app.claims', url: '/claims/{id}', delegate: 'ledger' },
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

// ignoreDiagnostics takes a readonly list of kinds.
const quietKinds: readonly MountDiagnosticKind[] = ['bareBaseNotFound'];

const router: ServerRouter = createServerRouter({
  mounts: {
    '/app': mount,
    '/admin': {
      routes,
      strategy: 'simulate',
      prewarm: 1,
      ignoreDiagnostics: quietKinds,
    },
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

  if (verdict.kind === 'delegate') {
    void verdict.delegate.length;
    void verdict.state.length;
    void verdict.params;

    return verdict.mount.length;
  }

  // `notFound` is the only arm whose `mount` is optional.
  void verdict.mount?.length;

  return 404;
}

// Diagnostics take the router createServerRouter returns.
export function diagnosticLines(): string[] {
  const diagnostics: MountDiagnostic[] = diagnoseMounts(router);

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

// Ssr tier: a server router settled on one path, its transition handed back.
const settleOptions: SettleOptions = { timeout: 5_000 };

export async function settledState(
  router: UIRouter,
  path: string,
): Promise<string> {
  const transition = await settle(router, path, settleOptions);

  return transition.to().name ?? '';
}

// Ssr static tier: the loop with a string render, no renderer behind it.
const emitted = new Map<string, string>();

const writeEmitted: FileWriter = (file, body) => void emitted.set(file, body);

const legacyRules: RedirectLine[] = [
  { from: '/megacanvas', to: '/megacanvas.html', status: 301 },
];

const staticSite: PrerenderOptions = {
  mounts: { '/app': mount },
  outDir: 'dist',
  paths: ['/app/contacts', '/app/people'],
  render: (verdict, context: RenderContext) =>
    `<main data-file=${context.file}>${verdict.status ?? 200}</main>`,
  notFound: { file: '404.html' },
  rules: '_redirects',
  extraRules: legacyRules,
  trailingSlash: 'exact',
  write: writeEmitted,
  dryRun: true,
};

export async function staticTally(): Promise<{
  tally: PrerenderTally;
  first: EmittedPage | undefined;
}> {
  const result: PrerenderResult = await prerender(staticSite);

  return { tally: result.tally, first: result.pages[0] };
}

// Ssr payload: a typed resolve read back after adoption.
type SheetSummary = {
  readonly num: string;
  readonly tags: readonly string[];
};

interface SheetRecord {
  readonly num: string;
}

type IsAny<T> = 0 extends 1 & T ? true : false;

type AssignableTo<From, To> = [From] extends [To] ? true : false;

// A JSON-safe type alias fits the payload's value type; an interface lacks the
// index signature, and a Date is not JSON at all.
export const payloadValueTypes: [
  AssignableTo<SheetSummary, JsonValue>,
  AssignableTo<SheetRecord, JsonValue>,
  AssignableTo<Date, JsonValue>,
] = [true, false, false];

const summaryState: StateDeclaration = {
  name: 'sheet',
  url: '/sheet/:num',
  resolve: {
    summary: (): SheetSummary => ({ num: '7B', tags: ['plate'] }),
  },
};

export async function adoptedSummary(
  server: UIRouter,
  client: UIRouter,
): Promise<SheetSummary> {
  server.stateRegistry.register({ ...summaryState });
  client.stateRegistry.register({ ...summaryState });

  const drawn: DehydrateResult = dehydrate(await settle(server, '/sheet/7B'));
  void drawn.unserializable.map(({ state, token }) => `${state}.${token}`);

  // SAFETY: the document holds what dehydrate drew, after a JSON round trip.
  const payload = JSON.parse(JSON.stringify(drawn.payload)) as ResolvePayload;
  // The payload carries JSON, not the declaration's type.
  const carried: JsonValue | undefined = payload.resolves.sheet?.summary;
  void carried;

  const disarm: () => void = seed(client, payload);
  const transition = await settle(client, '/sheet/7B');
  disarm();

  // Core's injector reads every token as `any`, adopted or resolved alike, so
  // the declared type reaches the reader only as the reader's own assertion.
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- the any is what this probes
  const read = transition.injector().get('summary');
  const readIsAny: IsAny<typeof read> = true;
  void readIsAny;

  return transition.injector().get<SheetSummary>('summary');
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

declare module 'ui-router-server/fetch' {
  interface DelegateSeam {
    params: { 'app.claims': { id: string }; feed: { page: number } };
  }
}

// Untyped routes collapse to string keys and states, and the seam's names never reach them.
export function claimOf(request: Request): string {
  const context: DelegateContext<'ledger'> = delegateContext(request, 'ledger');
  const key: 'ledger' = context.delegate;
  const state: string = context.state;
  const subpath: string = context.subpath;
  const params: Readonly<RawParams> = context.params;
  const loose: DelegateContext = context;
  const states: DelegateState<'ledger'> = state;
  const raw: DelegateParams<'claims'> = { ...params };
  const keyed: DelegateKey = loose.delegate;

  const fromRouter: DelegateContext<'ledger'> = honoDelegateContext(
    request,
    'ledger',
    router,
  );

  return `${key} ${context.mount} ${subpath} ${states} ${String(raw.id)} ${keyed} ${fromRouter.state}`;
}

// The core augmentation admits the key on a shared client tree.
export const sharedState: StateDeclaration = {
  name: 'app.claims',
  url: '/claims/{id}',
  delegate: 'ledger',
};

// A delegate is fetch-shaped: the request, then whatever the adapter was called with.
const ledger: DelegateHandler = (request) =>
  new Response(claimOf(request), { status: 202 });

interface WorkerEnv {
  QUEUE: string;
}

const workerLedger: DelegateHandler<[env: WorkerEnv, ctx: unknown]> = (
  request,
  env,
) => new Response(`${request.method} ${env.QUEUE}`, { status: 202 });

export const workerHandler: FetchHandler<[env: WorkerEnv, ctx: unknown]> =
  createFetchHandler(router, {
    serveShell: (_mountBase, request) => new Response(request.url),
    delegates: { ledger: workerLedger },
  });

// An untyped router leaves delegates optional.
export const undelegated: FetchHandler = createFetchHandler(router, {
  serveShell: (_mountBase, request) => new Response(request.url),
});

// Hono's app.fetch fits bare; the middleware forwards c.env and executionCtx.
const ledgerApp = new Hono<{ Bindings: WorkerEnv }>();

export const honoDelegating: MiddlewareHandler<{ Bindings: WorkerEnv }> =
  serverRouterHono(router, {
    serveShell: (_mountBase, request) => new Response(request.url),
    delegates: { ledger: ledgerApp.fetch },
  });

export const honoArgs: HonoDelegateArgs<{ Bindings: WorkerEnv }> = [
  { QUEUE: 'q' },
  undefined,
];

// Typed routers: `as const` routes type the keys, states and params per instance.
const claimRoutes = [
  { name: 'app', url: '' },
  { name: 'app.claims', url: '/claims/{id}', delegate: 'ledger' },
  { name: 'app.receipts', url: '/receipts', delegate: 'ledger' },
] as const;

const feedRoutes = [{ name: 'feed', url: '/feed', delegate: 'feed' }] as const;

const claimsRouter = createServerRouter({
  mounts: { '/app': { routes: claimRoutes }, '/feeds': { routes: feedRoutes } },
});

const receiptsRouter = createServerRouter({
  mounts: { '/': { routes: claimRoutes, strategy: 'simulate' } },
});

export const typedKey: DelegateKey<
  (typeof claimRoutes)[number] | (typeof feedRoutes)[number]
> = 'feed';

export const typedHandlers: DelegateHandlers<[], (typeof feedRoutes)[number]> =
  { feed: ledger, extra: ledger };

export const required: RequiredDelegates<[], (typeof feedRoutes)[number]> = {
  delegates: { feed: ledger },
};

export const typedHandler: FetchHandler = createFetchHandler(claimsRouter, {
  serveShell: (_mountBase, request) => new Response(request.url),
  delegates: { ledger, feed: ledger },
});

export const otherTypedHandler: FetchHandler = createFetchHandler(
  receiptsRouter,
  {
    serveShell: (_mountBase, request) => new Response(request.url),
    delegates: { ledger },
  },
);

export const missingKey: FetchHandler = createFetchHandler(claimsRouter, {
  serveShell: (_mountBase, request) => new Response(request.url),
  // @ts-expect-error a typed router requires every key it names
  delegates: { ledger },
});

// @ts-expect-error a typed router that names keys requires delegates
export const missingDelegates: FetchHandler = createFetchHandler(claimsRouter, {
  serveShell: (_mountBase, request) => new Response(request.url),
});

export const honoMissingKey: MiddlewareHandler = serverRouterHono(
  claimsRouter,
  {
    serveShell: (_mountBase, request) => new Response(request.url),
    // @ts-expect-error the Hono adapter requires the same keys
    delegates: { ledger: ledgerApp.fetch },
  },
);

// The state narrows params through the seam.
export function typedClaimOf(request: Request): string {
  const context = delegateContext(request, 'ledger', claimsRouter);

  if (context.state === 'app.claims') {
    const id: string = context.params.id;

    return id;
  }

  const receipts: 'app.receipts' = context.state;
  const params: Readonly<RawParams> = context.params;

  // @ts-expect-error 'badge' is not a key the router names
  delegateContext(request, 'badge', claimsRouter);

  return `${receipts} ${String(params.id)}`;
}

export function feedPageOf(request: Request): number {
  return delegateContext(request, 'feed', claimsRouter).params.page;
}

const commandRoutes = [
  { name: 'api' },
  { name: 'api.claims', url: '/claims', delegate: 'claims' },
] as const;

const commandRouter = createServerRouter({
  mounts: { '/': { routes: commandRoutes } },
});

export const commandDecls: ServerRouterDeclarations<typeof commandRouter> =
  commandRoutes[1];

const claimsHandler = (request: Request, env: WorkerEnv): Response =>
  new Response(`${request.method} ${env.QUEUE}`, { status: 202 });

const serveShell = (_mountBase: string, request: Request): Response =>
  new Response(request.url);

export const commandHandler = createFetchHandler(commandRouter, {
  serveShell,
  delegates: { claims: claimsHandler },
});

export const commandCalled: Promise<Response | null> = commandHandler(
  new Request('https://ledger.test/claims'),
  { QUEUE: 'q' },
);

export const commandAnnotated: FetchHandler<[env: WorkerEnv]> =
  createFetchHandler(commandRouter, {
    serveShell,
    delegates: { claims: (request, env) => claimsHandler(request, env) },
  });

export const commandExplicit = createFetchHandler<
  typeof commandRouter,
  [env: WorkerEnv]
>(commandRouter, {
  serveShell,
  delegates: { claims: (request, env) => claimsHandler(request, env) },
});

// The key check holds whether `Args` is inferred, annotated or written out.
export const misspelledInferred = createFetchHandler(commandRouter, {
  serveShell,
  // @ts-expect-error 'claim' is not the key the router names
  delegates: { claim: claimsHandler },
});

export const misspelledAnnotated: FetchHandler<[env: WorkerEnv]> =
  createFetchHandler(commandRouter, {
    serveShell,
    // @ts-expect-error 'claim' is not the key the router names
    delegates: { claim: (request, env) => claimsHandler(request, env) },
  });

export const misspelledExplicit = createFetchHandler<
  typeof commandRouter,
  [env: WorkerEnv]
>(commandRouter, {
  serveShell,
  // @ts-expect-error 'claim' is not the key the router names
  delegates: { claim: (request, env) => claimsHandler(request, env) },
});

// @ts-expect-error the router's type comes first; `Args` alone no longer drops the key check
export const argsOnly = createFetchHandler<[env: WorkerEnv]>(commandRouter, {
  serveShell,
  delegates: { claims: claimsHandler },
});

// @ts-expect-error serveShell is required
export const missingShell: FetchHandler = createFetchHandler(claimsRouter, {
  delegates: { ledger, feed: ledger },
});

export const honoCommands: MiddlewareHandler<{ Bindings: WorkerEnv }> =
  serverRouterHono(commandRouter, {
    serveShell,
    delegates: { claims: ledgerApp.fetch },
  });

export const honoExplicit = serverRouterHono<
  typeof commandRouter,
  { Bindings: WorkerEnv }
>(commandRouter, {
  serveShell,
  // @ts-expect-error 'claim' is not the key the router names
  delegates: { claim: ledgerApp.fetch },
});

// A typed router still fits the untyped surface.
export const looseRouter: ServerRouter = claimsRouter;

export const typedDiagnostics: MountDiagnostic[] =
  diagnoseMounts(receiptsRouter);

export const typedMiddleware: ConnectMiddleware = createConnectMiddleware(
  claimsRouter,
  { delegates: 'next' },
);

const fetchOptions: FetchAdapterOptions = {
  shellPath: (mountBase) => mountBase,
  serveShell: (_mountBase, request) => new Response(request.url),
  // Promise-returning on purpose: the option's union accepts both arms.
  serveNotFound: (_mountBase, _request) =>
    Promise.resolve(new Response('not found', { status: 404 })),
  shouldHandle: (request) => request.method === 'GET',
  delegates: { ledger },
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
