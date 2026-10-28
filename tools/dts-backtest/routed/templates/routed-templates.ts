import { html } from 'lit';
import type { TypedLitStateDeclaration } from 'lit-ui-router';
import type { TypedStateService } from 'ui-router-registry';

declare const $state: TypedStateService;

// Un-annotated templates that read the registry their own states are registered in.
const editState = {
  name: 'contacts.contact.edit',
  url: '/edit',
  views: {
    '^.^.$default': () => {
      // @ts-expect-error a misspelled state name
      $state.href('contcts');

      return html`<a
        href=${$state.href('contacts.contact', { contactId: 'c1' })}
        >Done</a
      >`;
    },
    'header@contacts': {
      component: () => html`<a href=${$state.href('contacts')}>Back</a>`,
    },
  },
} as const satisfies TypedLitStateDeclaration;

const contactsState = {
  name: 'contacts',
  url: '/contacts',
  component: () =>
    html`<a href=${$state.href('contacts.contact', { contactId: 'c1' })}
      >First</a
    >`,
} as const satisfies TypedLitStateDeclaration;

const states = [
  contactsState,
  { name: 'contacts.contact', url: '/:contactId' } as const,
  editState,
];

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

export const editHref: string | null = $state.href('contacts.contact.edit', {
  contactId: 'c1',
});
