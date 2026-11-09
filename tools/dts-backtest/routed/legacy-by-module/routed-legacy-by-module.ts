// Must fail: run.ts expects TS2310, TS7022 and TS7023 here, since LitStateDeclaration infers render().
import { html, LitElement } from 'lit';
import type { LitStateDeclaration } from 'lit-ui-router';
import type { StatesOf, TypedStateService } from 'ui-router-registry';

declare const $state: TypedStateService;

class ContactView extends LitElement {
  render() {
    return html`<a href=${$state.href('contacts.contact', { contactId: 'c1' })}
      >Contact</a
    >`;
  }
}

const contactState = {
  name: 'contacts.contact',
  url: '/:contactId',
  component: ContactView,
} as const satisfies LitStateDeclaration;

const states = [{ name: 'contacts', url: '/contacts' } as const, contactState];

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof states> {}
}
