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
  // Url-less, as in main/states.ts: structural only — never matched, never a
  // redirect target — but declarable as an otherwise projection.
  { name: 'notFound' },
];

// Mirrors router.config.ts: the app root has no state url; a when(/^\/?$/)
// rule routes it to welcome. Its otherwise() -> notFound rule is deliberately
// NOT projected for the flagship mounts: unknown paths stay notFound verdicts
// (the not-found-static pattern) — 404 views stay out of entrance analytics
// and scanners get a few bytes; shell-at-404 is the /not-found-spa exhibit.
export const redirects: RedirectRule[] = [{ pattern: /^\/?$/, to: 'welcome' }];

// 'matcher': the tables above are pure data, so the dependency-free tier
// suffices. Routing the client decides conditionally (mymessages' DSR
// default, requiresAuth) is deliberately absent — the server must not pick a
// winner. If a rule ever needs hooks or resolves, flipping a mount to
// 'simulate' is config, not code.
const app: MountConfig = { routes, redirects, strategy: 'matcher' };

// The not-found-spa exhibit: an honest-404 SPA. It is the flagship mount plus
// one difference — the miss. Real routes and the root redirect earn a shell-200
// (its own base-baked build, VITE_SAMPLE_APP_BASE_URL /not-found-spa/, lets the
// client match deep links at this prefix), while the `otherwise` projection
// serves the app shell at an honest 404 for genuine misses; the client boots at
// the retained url and renders the rich in-app notFound state. The flagship
// carries no `otherwise`, so its miss is a static 404 page instead (see the
// fetch adapter's verdict mapping: an `otherwise` state is a status'd shell).
const notFoundSpaDemo: MountConfig = {
  ...app,
  otherwise: { state: 'notFound' },
};

// The simulated-routing exhibit: full router semantics server-side — the
// same tables, but every verdict computed by replaying the url through a
// headless @uirouter/core router (redirect rules, otherwise, and one day
// hooks/resolves all ride). Its own base-baked build (VITE_SAMPLE_APP_BASE_URL
// /simulated-routing/) lets the client render the very route the server
// computed; noindex (worker) still quarantines the exhibit from crawlers.
const simulatedRoutingDemo: MountConfig = {
  routes,
  redirects,
  strategy: 'simulate',
  otherwise: { state: 'notFound' },
};

// The hash-location demo: a hash client keeps the whole route in the fragment,
// so the server only ever sees the bare mount — and it MUST serve the shell at
// 200 there. A redirect at the root (the flagship's `/` -> welcome rule) would
// 302 the mount, and a 302 sends the browser to a new path, stripping the
// route the hash client entered with; that is exactly why hash mode is not
// first-class at the flagship mounts. A single url-less-prefix root route
// (`url: ''`) matches the empty subpath to a shell verdict with no redirect;
// `strict: false` extends it to the trailing-slash form (`/app-hash/`). Deep
// paths never occur under a hash client, so they stay honest 404s.
const hashDemo: MountConfig = {
  routes: [{ name: 'root', url: '' }],
  config: { strict: false },
};

/**
 * Both sample apps run the same route tree, each under its own mount
 * (not-found-static); the demo mounts exhibit the not-found-spa and
 * simulated-routing rungs (not-found-naive lives worker-side — it is the
 * absence of routing config), and /app-hash the hash-location shape (shell at
 * the root, no redirect, so the fragment survives entry).
 */
export const mounts: Record<string, MountConfig> = {
  '/app': app,
  '/app-mobx': app,
  '/app-hash': hashDemo,
  '/not-found-spa': notFoundSpaDemo,
  '/simulated-routing': simulatedRoutingDemo,
};
