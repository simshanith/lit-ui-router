/**
 * The sample apps' server-routing projection: route table, redirect table,
 * and the mount config feeding ui-router-server's createServerRouter. Pure
 * data — every matching and redirect decision lives in the package.
 */
import type {
  MountConfig,
  RedirectRule,
  RouteDeclaration,
} from 'ui-router-server';

// Mirrors the url-bearing states registered in sample-app-shared
// (src/app/*/states.ts); dotted names nest, urls append.
export const routes: RouteDeclaration[] = [
  { name: 'welcome', url: '/welcome' },
  { name: 'home', url: '/home' },
  { name: 'login', url: '/login' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
  { name: 'contacts.new', url: '/new' },
  { name: 'mymessages', url: '/mymessages' },
  { name: 'mymessages.compose', url: '/compose' },
  { name: 'mymessages.messagelist', url: '/:folderId' },
  { name: 'mymessages.messagelist.message', url: '/:messageId' },
  { name: 'prefs', url: '/prefs' },
];

// Mirrors router.config.ts: the app root has no state url; a when(/^\/?$/)
// rule routes it to welcome. Its otherwise() -> notFound rule is deliberately
// NOT projected for the flagship mounts: unknown paths stay notFound verdicts
// (the not-found-static pattern) — 404 and 200 serving byte-identical shell
// content reads as a soft-404 to crawlers, and an SPA booting on missing
// pages muddies entrance analytics.
export const redirects: RedirectRule[] = [{ pattern: /^\/?$/, to: 'welcome' }];

// 'matcher': the tables above are pure data, so the dependency-free tier
// suffices. Routing the client decides conditionally (mymessages' DSR
// default, requiresAuth) is deliberately absent — the server must not pick a
// winner. If a rule ever needs hooks or resolves, flipping a mount to
// 'simulate' is config, not code.
const app: MountConfig = { routes, redirects, strategy: 'matcher' };

// The not-found-spa exhibit: the otherwise projection (mirroring the client's
// otherwise() -> notFound rule) makes every path under this mount serve the
// app shell at an honest 404 — the client boots at the retained url and
// renders the rich in-app notFound state. It deliberately carries NO
// url-bearing routes: the shell bakes <base href="/app/">, so the client
// router cannot match deep links under this prefix — a shell-200 here would
// be exactly the soft-404 shape the flagship mounts avoid.
const notFoundSpaDemo: MountConfig = {
  routes: [{ name: 'notFound' }],
  otherwise: { state: 'notFound' },
};

/**
 * Both sample apps run the same route tree, each under its own mount
 * (not-found-static); the demo mount exhibits the not-found-spa pattern.
 */
export const mounts: Record<string, MountConfig> = {
  '/app': app,
  '/app-mobx': app,
  '/not-found-spa': notFoundSpaDemo,
};
