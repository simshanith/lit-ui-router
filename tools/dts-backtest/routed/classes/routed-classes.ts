import { html, LitElement, ReactiveElement } from 'lit';
import { LitElement as Lit2Element } from 'lit-2';
import type {
  LitStateDeclaration,
  TypedLitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';
import type { TypedStateService } from 'ui-router-registry';

declare const $state: TypedStateService;

// An un-annotated render() that reads the registry its own state is registered in.
class ContactView extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  render() {
    // @ts-expect-error a misspelled state name
    $state.href('contcts');

    return html`<a href=${$state.href('contacts.contact', { contactId: 'c1' })}
      >Contact</a
    >`;
  }
}

const contactState = {
  name: 'contacts.contact',
  url: '/:contactId',
  component: ContactView,
} as const satisfies TypedLitStateDeclaration;

const listState = {
  name: 'contacts',
  url: '/contacts',
  views: { list: ContactView, detail: { component: ContactView } },
} as const satisfies TypedLitStateDeclaration;

const states = [listState, contactState];

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

export const contactHref: string | null = $state.href('contacts.contact', {
  contactId: 'c1',
});

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

// A LitElement from a second lit copy at another version: <ui-view> can't render it, and warns in development.
class OtherLitView extends Lit2Element {}

OtherLitView satisfies TypedLitStateDeclaration['component'];

// @ts-expect-error LitStateDeclaration compares LitElement's private members, which each lit copy declares apart
OtherLitView satisfies LitStateDeclaration['component'];
