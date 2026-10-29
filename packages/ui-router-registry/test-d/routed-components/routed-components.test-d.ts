// Components whose un-annotated render reads the registry they're registered in: the registry's types depend on the
// declarations and the declarations' checks on the components, so a declaration that infers render() is circular.
// `LitStateDeclaration` infers it; this program holds `TypedLitStateDeclaration`, which doesn't.
// `tsc --noEmit` is the assertion; nothing runs this file.
import { html, LitElement, ReactiveElement } from 'lit';
import type {
  TypedLitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';
import type { TypedStateService } from 'ui-router-registry';

declare const $state: TypedStateService;

class ContactView extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  render() {
    // @ts-expect-error a misspelled state name
    $state.href('contcts');

    // @ts-expect-error a missing required param
    $state.target('contacts.contact.edit');

    return html`<a
      href=${$state.href('contacts.contact.edit', { contactId: 'c1' })}
      >Edit</a
    >`;
  }
}

const contactState = {
  name: 'contacts.contact',
  url: '/:contactId',
  component: ContactView,
} as const satisfies TypedLitStateDeclaration;

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
      component: () => {
        // @ts-expect-error a misspelled state name
        $state.target('contcts');

        return html`<a href=${$state.href('contacts')}>Back</a>`;
      },
    },
  },
} as const satisfies TypedLitStateDeclaration;

const contactsState = {
  name: 'contacts',
  url: '/contacts',
  component: () => {
    // @ts-expect-error a missing required param
    $state.target('contacts.contact.edit');

    return html`<a href=${$state.href('contacts.contact', { contactId: 'c1' })}
      >First</a
    >`;
  },
} as const satisfies TypedLitStateDeclaration;

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
NotAnElement satisfies TypedLitStateDeclaration['component'];

// @ts-expect-error an element that isn't a LitElement
ReactiveOnly satisfies TypedLitStateDeclaration['component'];
