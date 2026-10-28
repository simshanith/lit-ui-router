// Dependency-free on its own `./state-table` subpath, so the client imports it without ui-router-server's types.

/**
 * Every state the sample apps register, eagerly or from a future state's
 * module, as data: the client tree, its `Register` augmentation and the
 * server mounts all read it. `resolves` names a state's own resolve tokens;
 * their value types and functions bind by state name in sample-app-shared's
 * `registry/`.
 */
export const stateTable = [
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
  { name: 'contacts', parent: 'app', url: '/contacts', resolves: ['contacts'] },
  { name: 'contacts.contact', url: '/:contactId', resolves: ['contact'] },
  { name: 'contacts.contact.edit', url: '/edit' },
  { name: 'contacts.new', url: '/new' },
  {
    name: 'mymessages',
    parent: 'app',
    url: '/mymessages',
    resolves: ['folders'],
  },
  { name: 'mymessages.compose', url: '/compose', params: { message: {} } },
  {
    name: 'mymessages.messagelist',
    url: '/:folderId',
    params: { folderId: 'inbox' },
    resolves: ['folder', 'messages'],
  },
  {
    name: 'mymessages.messagelist.message',
    url: '/:messageId',
    resolves: ['message', 'nextMessageGetter'],
  },
  { name: 'prefs', parent: 'app', url: '/prefs' },
] as const;
