import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { UIViewInjectedProps, uiSref } from '@uirouter/lit';

import './ContactDetail';

@customElement('sample-contact-view')
export class ContactView extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor(public _uiViewProps: UIViewInjectedProps) {
    super();
  }

  get contact() {
    return this._uiViewProps.resolves.contact;
  }

  render() {
    const { contact } = this;
    const composeButton = html`<button
      class="btn btn-primary"
      ${uiSref('mymessages.compose', { message: { to: contact.email } })}
    >
      <i class="fa fa-envelope"></i><span>Message</span>
    </button>`;
    const editContactButton = html`<button
      class="btn btn-primary"
      ${uiSref('.edit')}
    >
      <i class="fa fa-pencil"></i><span>Edit Contact</span>
    </button>`;
    return html`<div class="contact">
      <sample-contact-detail .contact=${contact}></sample-contact-detail>
      ${composeButton} ${editContactButton}
    </div>`;
  }
}

export default ContactView;
