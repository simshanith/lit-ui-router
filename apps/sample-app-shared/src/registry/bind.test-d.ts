// Type-level spec for binding by state name: `tsc --noEmit` is the assertion.
import { html } from 'lit';
import type { UIViewInjectedProps } from 'lit-ui-router';

import { contactsTable } from 'sample-app-routes/state-table/contacts';
import { prefsTable } from 'sample-app-routes/state-table/prefs';

import type { Contact } from '../app/contacts/interface.js';
import ContactView from '../app/contacts/ContactView.js';
import { bindStates } from './bind.js';
import type { StateResolves, TableRow } from './states.js';

declare const contact: Contact;

// A one-row table, so a case binds the single state it's about.
declare function only<N extends TableRow['name']>(
  name: N,
): readonly Extract<TableRow, { name: N }>[];

// -- names: a binding's key is a table state ----------------------------------

bindStates(only('welcome'), { welcome: {} });

bindStates(only('contacts.**'), {
  // @ts-expect-error a misspelled state name
  welcom: {},
});

bindStates(only('contacts.**'), {
  // @ts-expect-error a state from another module's table
  'contacts.new': {},
});

// -- coverage: every row but a future state's is bound -------------------------

bindStates(prefsTable, { prefs: {} });

// @ts-expect-error a table row left unbound
bindStates(contactsTable, {
  contacts: { resolve: { contacts: { resolveFn: () => [contact] } } },
});

// -- components: checked by the resolves their state provides -----------------

bindStates(only('contacts.contact'), {
  'contacts.contact': {
    component: ContactView,
    resolve: { contact: { resolveFn: () => contact } },
  },
});

bindStates(only('contacts.contact.edit'), {
  'contacts.contact.edit': {
    // a child state's views also receive its ancestors' resolves
    component: ContactView,
  },
});

bindStates(only('contacts'), {
  contacts: {
    // @ts-expect-error a state-typed component on a state without its resolves
    component: ContactView,
    resolve: { contacts: { resolveFn: () => [contact] } },
  },
});

bindStates(only('welcome'), {
  welcome: {
    // @ts-expect-error a template reading a resolve the state doesn't provide
    component: (props: UIViewInjectedProps<StateResolves<'contacts'>>) =>
      html`${props.resolves.contacts.length}`,
  },
});

// -- resolves: every token the table names, with its value type ----------------

bindStates(only('contacts'), {
  // @ts-expect-error a missing resolve function for the table's `contacts` token
  contacts: {},
});

bindStates(only('contacts'), {
  contacts: {
    // @ts-expect-error a resolve function returning the wrong value type
    resolve: { contacts: { resolveFn: () => contact } },
  },
});

bindStates(only('welcome'), {
  welcome: {
    // @ts-expect-error a resolve the table doesn't name
    resolve: { contacts: { resolveFn: () => [contact] } },
  },
});

// -- table data stays in the table ---------------------------------------------

bindStates(only('welcome'), {
  // @ts-expect-error a url belongs to the table, not the binding
  welcome: { url: '/hello' },
});
