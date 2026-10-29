// Dependency-free on its own `./state-table/mymessages` subpath, so only the mymessages chunk carries it.

/** The mymessages module's states, which `app`'s `mymessages.**` future state loads. */
export const mymessagesTable = [
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
] as const;
