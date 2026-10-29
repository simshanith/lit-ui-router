// One module's table, registered next to it.
import type { StatesOf } from 'ui-router-registry';

export const contactsStates = [
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof contactsStates> {}
}
