/**
 * The types that sit beside the per-module state tables
 * (`sample-app-routes/state-table/*`): the rows each module registers, and
 * each resolve token's value type.
 */
import type { TargetState } from '@uirouter/core';
import type { appTable } from 'sample-app-routes/state-table/app';
import type { contactsTable } from 'sample-app-routes/state-table/contacts';
import type { mymessagesTable } from 'sample-app-routes/state-table/mymessages';
import type { prefsTable } from 'sample-app-routes/state-table/prefs';

import type { Contact } from '../app/contacts/interface.js';
import type { Folder, Message } from '../app/mymessages/interface.js';

/** A row from any module's table. */
// The subpaths, not the index: the apps' programs reject the index's `.ts` imports.
export type TableRow = (
  | typeof appTable
  | typeof contactsTable
  | typeof mymessagesTable
  | typeof prefsTable
)[number];

// A future state is data for the server and the placeholder; nothing binds to it.
type Row = Exclude<TableRow, { name: `${string}.**` }>;

/** A state name from the shared tables, future states excluded. */
export type SampleAppStateName = Row['name'];

/** Param value types the runtime-neutral table can't name, by state. */
interface ParamTypes {
  'mymessages.compose': { message: Partial<Message> };
}

type WithParamTypes<R> = R extends { name: infer N extends keyof ParamTypes }
  ? Omit<R, 'params'> & { readonly params: ParamTypes[N] }
  : R;

/** A module's table as it registers, with the param types the table can't name. */
export type RegisteredRows<T extends readonly TableRow[]> =
  readonly WithParamTypes<T[number]>[];

/** What each resolve token in the table resolves to. */
export interface ResolveValues {
  returnTo: TargetState;
  attemptedPath: string | null;
  contacts: Contact[];
  contact: Contact;
  folders: Folder[];
  folder: Folder;
  messages: Message[];
  message: Message;
  nextMessageGetter: (messageId: string) => string | undefined;
}

type RowOf<N> = Extract<Row, { name: N }>;

/** The resolve tokens a state declares itself. */
export type OwnTokens<N> = N extends unknown
  ? RowOf<N> extends { resolves: readonly (infer T)[] }
    ? T
    : never
  : never;

// Fails to compile when the table names a token without a value type above.
type TokenValues = { [T in OwnTokens<SampleAppStateName>]: ResolveValues[T] };

type DropLast<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? Tail extends `${string}.${string}`
    ? `${Head}.${DropLast<Tail>}`
    : Head
  : never;

type ParentOf<R> = R extends { parent: infer P extends string }
  ? P
  : R extends { name: infer N extends string }
    ? DropLast<N>
    : never;

type Lineage<N> = [RowOf<N>] extends [never]
  ? never
  : N | Lineage<ParentOf<RowOf<N>>>;

/** The resolves a state's views receive: its own and its ancestors'. */
export type StateResolves<N extends SampleAppStateName> = Pick<
  TokenValues,
  OwnTokens<Lineage<N>> & keyof TokenValues
>;
