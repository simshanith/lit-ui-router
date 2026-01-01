import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { UIViewInjectedProps, uiSref } from 'lit-ui-router';
import { isEqual, cloneDeep } from 'lodash';

import './ContactList.js';
import './ContactForm.js';
import { Contact } from './interface.js';
import { ContactsStorage } from '../global/dataSources.js';
import DialogService from '../global/dialogService.js';

/**
 * The EditContact component
 *
 * This component is used by both `contacts.contact.edit` and `contacts.new` states.
 *
 * The component makes a copy of the contact data for editing by assigning it to the component state.
 * The new copy and original (pristine) copy are used to determine if the contact is "dirty" or not.
 * If the user navigates to some other state while the contact is "dirty", the `uiCanExit` component
 * hook asks the user to confirm navigation away, losing any edits.
 *
 * The Delete Contact button is wired to the `remove` method, which:
 * - asks for confirmation from the user
 * - deletes the resource from REST API
 * - navigates back to the contacts grandparent state using relative addressing `^.^`
 *   the `reload: true` option re-fetches the contacts list from the server
 *
 * The Save Contact button is wired to the `save` method which:
 * - saves the REST resource (PUT or POST, depending)
 * - navigates back to the parent state using relative addressing `^`.
 *   when editing an existing contact, this returns to the `contacts.contact` "view contact" state
 *   when creating a new contact, this returns to the `contacts` list.
 *   the `reload: true` option re-fetches the contacts resolve data from the server
 */
@customElement('sample-edit-contact')
export class EditContact extends LitElement {
  createRenderRoot() {
    return this;
  }

  get contact(): Contact | undefined {
    return this._uiViewProps.resolves?.contact;
  }

  @state()
  canExit = false;

  @state()
  updatedContact = cloneDeep(this.contact);

  constructor(public _uiViewProps: UIViewInjectedProps) {
    super();
  }

  uiCanExit = async () => {
    if (this.canExit || isEqual(this.contact, this.updatedContact)) return true;

    const message = 'You have unsaved changes to this contact.';
    const question = 'Navigate away and lose changes?';
    this.canExit = await DialogService.confirm(message, question);
    return this.canExit;
  };

  handleChangeContact = (e: CustomEvent<Contact>) => {
    this.updatedContact = { ...this.updatedContact, ...e.detail };
  };

  saveContact = () => {
    // Save the contact, then go to the parent state (either 'contacts' or 'contacts.contact')
    const { stateService } = this._uiViewProps.router;
    ContactsStorage.save(this.updatedContact)
      .then(() => (this.canExit = true))
      .then(() => stateService.go('^', undefined, { reload: true }));
  };

  removeContact = () => {
    // Ask for confirmation, then delete the contact, then go to the grandparent state ('contacts')
    const contact = this.updatedContact;
    const { stateService } = this._uiViewProps.router;
    DialogService.confirm(
      `Delete contact: ${contact?.name.first} ${contact?.name.last}`,
    )
      .then(() => ContactsStorage.remove(contact))
      .then(() => (this.canExit = true))
      .then(() => stateService.go('^.^', undefined, { reload: true }));
  };

  render() {
    return html`<div class="contact">
      <sample-contact-form
        .contact=${this.updatedContact}
        @change=${this.handleChangeContact}
      ></sample-contact-form>
      <hr />
      <div>
        <button ${uiSref('^')} class="btn btn-primary">
          <i class="fa fa-close"></i><span>Cancel</span>
        </button>
        <button class="btn btn-primary" @click=${this.saveContact}>
          <i class="fa fa-save"></i><span>Save</span>
        </button>
        <button class="btn btn-primary" @click=${this.removeContact}>
          <i class="fa fa-close"></i><span>Delete</span>
        </button>
      </div>
    </div>`;
  }
}

export default EditContact;
