// The TypeScript half of a mixed project: one `Register` augmentation, and no other import.
export const states = [
  { name: 'home', url: '/home' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
] as const;

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}
