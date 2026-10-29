// Dependency-free on its own `./state-table/contacts` subpath, so only the contacts chunk carries it.

/** The contacts module's states, which `app`'s `contacts.**` future state loads. */
export const contactsTable = [
  { name: 'contacts', parent: 'app', url: '/contacts', resolves: ['contacts'] },
  { name: 'contacts.contact', url: '/:contactId', resolves: ['contact'] },
  { name: 'contacts.contact.edit', url: '/edit' },
  { name: 'contacts.new', url: '/new' },
] as const;
