import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('sample-contact-detail')
export class ContactDetail extends LitElement {
  @property()
  contact;

  createRenderRoot() {
    return this;
  }

  render() {
    const { contact } = this;
    return html`
      <div class="flex-h">
        <div class="details">
          <h3>${contact.name.first + ' ' + contact.name.last}</h3>
          <div><label>Company</label><div>${contact.company}</div></div>
          <div><label>Age</label><div>${contact.age}</div></div>
          <div><label>Phone</label><div>${contact.phone}</div></div>
          <div><label>Email</label><div>${contact.email}</div></div>
          ${ contact.address ? html`<div class="flex-h">
            <label>Address</label>
            <div>${contact.address.street}<br />
              ${contact.address.city + ', ' + contact.address.state + ' ' + contact.address.zip}
            </div>
          </div>` : null}
        </div>

        <div class="flex nogrow">
          <img src=${contact.picture}/>
        </div>
      </div>`;
  }
}

export default ContactDetail;
