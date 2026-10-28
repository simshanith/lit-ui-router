import { html } from 'lit';
import { Transition } from '@uirouter/core';

import { ContactsStorage } from '../global/dataSources.js';
import { bindStates } from '../../registry/bind.js';
import type { StateResolves } from '../../registry/states.js';
import type { UIViewInjectedProps } from 'lit-ui-router';

import './Contacts.js';
import ContactView from './ContactView.js';
import { type Contact } from './interface.js';
import EditContact from './EditContact.js';

import { dsrRedirectToDefaultFromWithin } from '../util/dsr-default-redirect-within.js';

function contactName(transition: Transition) {
  // SAFETY: only contacts.contact titles with this, and its `contact` resolve yields a Contact
  const { name } = transition.injector().get('contact') as Contact;

  return `${name.first} ${name.last}`;
}

/** The contacts module's states, bound by name to the shared state table. */
export const states = bindStates({
  /**
   * This state displays the contact list.
   * It also provides a nested ui-view (viewport) for child states to fill in.
   *
   * The contacts are fetched using a resolve.
   */
  contacts: {
    resolve: {
      // Resolve all the contacts. The resolved contacts are injected as props into the Contacts component.
      contacts: { resolveFn: () => ContactsStorage.all() },
    },
    data: { requiresAuth: true, title: 'Contacts' },
    dsr: {
      default: 'contacts',
      fn: dsrRedirectToDefaultFromWithin,
    },
    sticky: true,
    views: {
      contacts: (props: UIViewInjectedProps<StateResolves<'contacts'>>) =>
        html`<sample-contacts ._uiViewProps=${props}></sample-contacts>`,
    },
  },
  /**
   * This state displays a single contact.
   * The contact to display is fetched using a resolve, based on the `contactId` parameter.
   */
  'contacts.contact': {
    resolve: {
      // Resolve the contact, based on the contactId parameter value.
      // The resolved contact is provided to the contactComponent's contact binding
      contact: {
        deps: ['$transition$'],
        resolveFn: async ($transition$: Transition) =>
          // SAFETY: the untyped SessionStorage fake-REST client resolves a Contact here
          ContactsStorage.get(
            $transition$.params().contactId,
          ) as Promise<Contact>,
      },
    },
    data: { title: contactName, analyticsTitle: 'Contact', keepScroll: true },
    component: ContactView,
  },
  /**
   * This state allows a user to edit a contact
   *
   * The contact data to edit is injected from the parent state's resolve.
   *
   * This state uses view targeting to replace the parent ui-view (which would normally be filled
   * by 'contacts.contact') with the edit contact template/controller
   */
  'contacts.contact.edit': {
    data: {
      title: (transition: Transition) => `Edit ${contactName(transition)}`,
      analyticsTitle: 'Edit contact',
    },
    views: {
      // Relatively target the grand-parent-state's $default (unnamed) ui-view
      // This could also have been written using ui-view@state addressing: $default@contacts
      // Or, this could also have been written using absolute ui-view addressing: !$default.contacts.$default
      '^.^.$default': EditContact,
    },
  },
  /**
   * This state allows a user to create a new contact
   *
   * The contact data to edit is injected into the component from the parent state's resolve.
   */
  'contacts.new': {
    data: { title: 'New contact' },
    component: EditContact,
  },
});
