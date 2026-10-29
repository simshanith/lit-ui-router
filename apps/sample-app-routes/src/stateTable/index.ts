// Dependency-free on its own `./state-table` subpath, so the client imports it without ui-router-server's types.
import { appTable } from './app.ts';
import { contactsTable } from './contacts.ts';
import { mymessagesTable } from './mymessages.ts';
import { prefsTable } from './prefs.ts';

/**
 * Every module's table, as data: the server mounts and the client's types
 * read the whole tree here, while each module binds and registers only its
 * own subpath's rows. `resolves` names a state's own resolve tokens; their
 * value types and functions bind by state name in sample-app-shared's
 * `registry/`.
 */
export const stateTable = [
  ...appTable,
  ...contactsTable,
  ...mymessagesTable,
  ...prefsTable,
] as const;
