import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { get, set } from 'lodash';
import { Contact } from './interface.js';

const formInputs = [
  { label: 'First', path: 'name.first' },
  { label: 'Last', path: 'name.last' },
  { label: 'Company', path: 'company' },
  { label: 'Age', path: 'age' },
  { label: 'Phone', path: 'phone' },
  { label: 'Email', path: 'email' },
  { label: 'Street', path: 'address.street' },
  { label: 'City', path: 'address.city' },
  { label: 'State', path: 'address.state' },
  { label: 'Zip', path: 'address.zip' },
  { label: 'Image', path: 'picture' },
];

@customElement('sample-contact-form')
export class ContactForm extends LitElement {
  @property({ attribute: false })
  contact!: Contact;

  handleChangeFor(path: string) {
    const { contact } = this;
    return (event: Event) => {
      this.dispatchEvent(
        new CustomEvent('change', {
          detail: set(
            { ...contact },
            path,
            (event.target as HTMLInputElement).value,
          ),
        }),
      );
    };
  }

  render() {
    const { contact } = this;
    const inputs = formInputs.map((input) => {
      return html`<div>
        <label>${input.label}</label>
        <input
          type="text"
          value=${get(contact, input.path)}
          @change=${this.handleChangeFor(input.path)}
        />
      </div>`;
    });
    return html`<div class="details">${inputs}</div>`;
  }
}

export default ContactForm;
