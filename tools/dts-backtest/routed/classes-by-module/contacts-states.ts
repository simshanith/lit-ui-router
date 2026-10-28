// One module's un-annotated render() reads names the other module registers.
import { html, LitElement } from 'lit';
import {
  type TypedLitStateDeclaration,
  type UIViewInjectedProps,
  uiSref,
} from 'lit-ui-router';
import type { StatesOf, TypedStateService } from 'ui-router-registry';

declare const $state: TypedStateService;

class ContactView extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  render() {
    // @ts-expect-error a misspelled state name from the other module
    uiSref('mesages');

    return html`<a ${uiSref('messages.message', { messageId: 1 })}>Message</a>
      <a href=${$state.href('contacts.contact', { contactId: 'c1' })}>Self</a>`;
  }
}

export const contactsStates = [
  { name: 'contacts', url: '/contacts' },
  {
    name: 'contacts.contact',
    url: '/:contactId',
    component: ContactView,
  } as const satisfies TypedLitStateDeclaration,
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof contactsStates> {}
}
