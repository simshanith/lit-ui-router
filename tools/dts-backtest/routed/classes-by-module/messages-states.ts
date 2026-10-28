// The other module, whose component links back into the contacts module.
import { html, LitElement } from 'lit';
import {
  type TypedLitStateDeclaration,
  type UIViewInjectedProps,
  uiSref,
} from 'lit-ui-router';
import type { StatesOf } from 'ui-router-registry';

class MessageView extends LitElement {
  declare _uiViewProps?: UIViewInjectedProps;

  render() {
    // @ts-expect-error a missing required param from the other module
    uiSref('contacts.contact');

    return html`<a ${uiSref('contacts.contact', { contactId: 'c1' })}>From</a>`;
  }
}

export const messagesStates = [
  { name: 'messages', url: '/messages' },
  {
    name: 'messages.message',
    url: '/{messageId:int}',
    component: MessageView,
  } as const satisfies TypedLitStateDeclaration,
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof messagesStates> {}
}
