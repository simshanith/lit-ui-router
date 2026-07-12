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
// rule routes it to welcome. Its otherwise() -> notFound rule is NOT
// mirrored, so unknown paths stay notFound verdicts (real server 404s).
export const redirects: RedirectRule[] = [{ pattern: /^\/?$/, to: 'welcome' }];

// 'matcher': the tables above are pure data, so the dependency-free tier
// suffices. Routing the client decides conditionally (mymessages' DSR
// default, requiresAuth) is deliberately absent — the server must not pick a
// winner. If a rule ever needs hooks or resolves, flipping a mount to
// 'simulate' is config, not code.
const app: MountConfig = { routes, redirects, strategy: 'matcher' };

/** Both sample apps run the same route tree, each under its own mount. */
export const mounts: Record<string, MountConfig> = {
  '/app': app,
  '/app-mobx': app,
};
