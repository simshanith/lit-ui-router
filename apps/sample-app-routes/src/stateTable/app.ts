// Dependency-free on its own `./state-table/app` subpath, like each module's table.

/**
 * The eagerly registered states, plus a future state for each lazy module at
 * the url and parent its root row gives it.
 */
export const appTable = [
  { name: 'app', redirectTo: 'welcome' },
  { name: 'welcome', parent: 'app', url: '/welcome' },
  { name: 'home', parent: 'app', url: '/home' },
  { name: 'login', parent: 'app', url: '/login', resolves: ['returnTo'] },
  {
    name: 'notFound',
    parent: 'app',
    params: { attemptedPath: null },
    resolves: ['attemptedPath'],
  },
  { name: 'contacts.**', parent: 'app', url: '/contacts' },
  { name: 'prefs.**', parent: 'app', url: '/prefs' },
  { name: 'mymessages.**', parent: 'app', url: '/mymessages' },
] as const;
