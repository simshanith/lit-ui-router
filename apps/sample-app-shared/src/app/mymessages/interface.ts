/** Resolves provided by the `mymessages.messagelist` state (see states.ts). */
export interface MessageListResolves {
  folder: { _id: string; columns: string[] };
  messages: Message[];
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
  [key: string]: unknown;
}
