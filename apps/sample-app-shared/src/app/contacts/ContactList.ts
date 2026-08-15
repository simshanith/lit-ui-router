import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { uiSref, uiSrefActive } from 'lit-ui-router';

import './ContactList.js';
import { Contact } from './interface.js';

@customElement('sample-contact-list')
export class ContactList extends LitElement {
  @property({ attribute: false })
  contacts: Contact[] = [];

  createRenderRoot() {
    return this;
  }

  render() {
    // One control, not an <a> wrapping a <button>: nesting them gave two tab
    // stops and put interactive content inside a link, which the content model
    // forbids. Matches the button-shaped navigation used elsewhere in the app.
    const newContact = html`
      <button class="btn btn-primary" ${uiSref('.new')}>
        <i class="fa fa-pencil"></i><span>New Contact</span>
      </button>
    `;
    const contacts = repeat(
      this.contacts,
      ({ _id }) => _id,
      ({ _id, name }) =>
        html`<li>
          <a
            ${uiSrefActive({
              activeClasses: ['selected'],
            })}
            ${uiSref('.contact', { contactId: _id })}
          >
            ${name.first + ' ' + name.last}
          </a>
        </li>`,
    );
    return html`<ul class="selectlist list-unstyled flex nogrow">
      <li>${newContact}</li>
      <li>&nbsp;</li>
      ${contacts}
    </ul>`;
  }
}

export default ContactList;
