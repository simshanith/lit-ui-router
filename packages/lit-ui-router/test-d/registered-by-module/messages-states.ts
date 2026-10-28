// A second module's table, with a child of a state the contacts module registers.
import type { StatesOf } from 'ui-router-registry';

export const messagesStates = [
  { name: 'messages', url: '/messages' },
  { name: 'messages.list', url: '/:folderId', params: { folderId: 'inbox' } },
  { name: 'messages.list.message', url: '/{messageId:int}' },
  { name: 'contacts.contact.messages', url: '/messages?{page:int}' },
] as const;

declare module 'ui-router-registry' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<typeof messagesStates> {}
}
