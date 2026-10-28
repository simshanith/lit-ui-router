// Type-level spec for binding by state name: `tsc --noEmit` is the assertion.
import { html } from 'lit';
import type { UIViewInjectedProps } from 'lit-ui-router';

import type { Contact } from '../app/contacts/interface.js';
import ContactView from '../app/contacts/ContactView.js';
import { bindStates } from './bind.js';
import type { StateResolves } from './states.js';

declare const contact: Contact;

// -- names: a binding's key is a table state ----------------------------------

bindStates({ welcome: {} });

bindStates({
  // @ts-expect-error a misspelled state name
  welcom: {},
});

// -- components: checked by the resolves their state provides -----------------

bindStates({
  'contacts.contact': {
    component: ContactView,
    resolve: { contact: { resolveFn: () => contact } },
  },
});

bindStates({
  'contacts.contact.edit': {
    // a child state's views also receive its ancestors' resolves
    component: ContactView,
  },
});

bindStates({
  contacts: {
    // @ts-expect-error a state-typed component on a state without its resolves
    component: ContactView,
    resolve: { contacts: { resolveFn: () => [contact] } },
  },
});

bindStates({
  welcome: {
    // @ts-expect-error a template reading a resolve the state doesn't provide
    component: (props: UIViewInjectedProps<StateResolves<'contacts'>>) =>
      html`${props.resolves.contacts.length}`,
  },
});

// -- resolves: every token the table names, with its value type ----------------

bindStates({
  // @ts-expect-error a missing resolve function for the table's `contacts` token
  contacts: {},
});

bindStates({
  contacts: {
    // @ts-expect-error a resolve function returning the wrong value type
    resolve: { contacts: { resolveFn: () => contact } },
  },
});

bindStates({
  welcome: {
    // @ts-expect-error a resolve the table doesn't name
    resolve: { contacts: { resolveFn: () => [contact] } },
  },
});

// -- table data stays in the table ---------------------------------------------

bindStates({
  // @ts-expect-error a url belongs to the table, not the binding
  welcome: { url: '/hello' },
});
