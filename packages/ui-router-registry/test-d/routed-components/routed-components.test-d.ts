// Components whose un-annotated render reads the registry they're registered in: the registry's types depend on the
// declarations and the declarations' checks on the components, so a declaration that infers render() is circular.
// `tsc --noEmit` is the assertion; nothing runs this file.
import { html, LitElement, ReactiveElement } from 'lit';
import { uiSref } from 'lit-ui-router';
import type { LitStateDeclaration, UIViewInjectedProps } from 'lit-ui-router';
import type {} from 'ui-router-registry';
import type {} from 'ui-router-registry/lit';

class ContactView extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  render() {
    // @ts-expect-error a misspelled state name
    uiSref('contcts');

    // @ts-expect-error a missing required param
    uiSref('contacts.contact');

    return html`<a ${uiSref('contacts.contact.edit', { contactId: 'c1' })}
      >Edit</a
    >`;
  }
}

const contactState = {
  name: 'contacts.contact',
  url: '/:contactId',
  component: ContactView,
} as const satisfies LitStateDeclaration;

const editState = {
  name: 'contacts.contact.edit',
  url: '/edit',
  views: {
    '^.^.$default': () => {
      // @ts-expect-error a misspelled state name
      uiSref('contcts');

      return html`<a ${uiSref('contacts.contact', { contactId: 'c1' })}
        >Done</a
      >`;
    },
    'header@contacts': {
      component: () => {
        // @ts-expect-error a misspelled state name
        uiSref('contcts');

        return html`<a ${uiSref('contacts')}>Back</a>`;
      },
    },
  },
} as const satisfies LitStateDeclaration;

const contactsState = {
  name: 'contacts',
  url: '/contacts',
  component: () => {
    // @ts-expect-error a missing required param
    uiSref('contacts.contact.edit');

    return html`<a ${uiSref('contacts.contact', { contactId: 'c1' })}
      >First</a
    >`;
  },
} as const satisfies LitStateDeclaration;

export const states = [contactsState, contactState, editState];

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

class NotAnElement {
  render() {
    return html``;
  }
}

class ReactiveOnly extends ReactiveElement {}

// @ts-expect-error a class that isn't an element
NotAnElement satisfies LitStateDeclaration['component'];

// @ts-expect-error an element that isn't a LitElement
ReactiveOnly satisfies LitStateDeclaration['component'];
