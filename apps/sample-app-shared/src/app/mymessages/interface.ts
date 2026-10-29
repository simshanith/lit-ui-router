import type { StateResolves } from '../../registry/states.js';

/** Resolves provided to the `mymessages.messagelist` state's views, typed by the state. */
export type MessageListResolves = StateResolves<'mymessages.messagelist'>;

/** A mail folder, as the Folders service returns it. */
export interface Folder {
  _id: string;
  columns: string[];
  actions: string[];
}

export interface Message {
  _id: string;
  read: boolean;
  from: string;
  to?: string;
  date: string;
  subject: string;
  body: string;
  folder?: string;
  [key: string]: string | boolean | undefined;
}
