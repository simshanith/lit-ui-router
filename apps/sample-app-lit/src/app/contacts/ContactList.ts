import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { uiSref, uiSrefActive } from '@uirouter/lit';

import './ContactList.js';

@customElement('sample-contact-list')
export class ContactList extends LitElement {
  @property({ attribute: false })
  contacts: { _id: string; name: { first: string; last: string } }[] = [];

  createRenderRoot() {
    return this;
  }

  render() {
    const newContact = html`
      <a ${uiSref('.new')}>
        <button class="btn btn-primary">
          <i class="fa fa-pencil"></i><span>New Contact</span>
        </button>
      </a>
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
