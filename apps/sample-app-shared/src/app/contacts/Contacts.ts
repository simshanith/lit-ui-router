import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { UIViewInjectedProps } from 'lit-ui-router';

import './ContactList.js';
import { Contact } from './interface.js';

export interface ContactsResolves {
  contacts: Contact[];
}

@customElement('sample-contacts')
export class Contacts extends LitElement {
  createRenderRoot() {
    return this;
  }

  /** @public — router-assigned; the `_` prefix is convention, not privacy. */
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps<ContactsResolves>;

  constructor(_uiViewProps: UIViewInjectedProps<ContactsResolves>) {
    super();
    this._uiViewProps = _uiViewProps;
  }

  get contacts() {
    return [...(this._uiViewProps?.resolves?.contacts ?? [])];
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
