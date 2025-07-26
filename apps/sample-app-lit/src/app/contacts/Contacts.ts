import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { UIViewInjectedProps, RoutedLitElement } from '@uirouter/lit';

import './ContactList';

@customElement('sample-contacts')
export class Contacts extends RoutedLitElement {
  createRenderRoot() {
    return this;
  }

  get contacts() {
    return [...this._uiViewProps.resolves.contacts];
  }

  render() {
    return html`<div class="my-contacts flex-h">
      <sample-contact-list
        .contacts=${this.contacts}
        class="flex nogrow"
      ></sample-contact-list>
      <ui-view><h4 style="margin: 1em 2em">Select a contact</h4></ui-view>
    </div>`;
  }
}

export default Contacts;
