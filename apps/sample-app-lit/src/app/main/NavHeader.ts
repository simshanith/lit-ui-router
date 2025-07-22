import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js'
import { uiSref, uiSrefActive } from '@lit-ui-router/lit-ui-router';

import AppConfig from '../global/appConfig';
import AuthService from '../global/authService';


@customElement('sample-nav-header')
export class NavHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  handleLogout() {
    this.dispatchEvent(new Event('logout'));
  }

  render() {
    const isAuthenticated = AuthService.isAuthenticated();
    const { emailAddress } = AppConfig;
    const navbar = html`
      <ul class="nav nav-tabs">
        <li ${uiSrefActive({
          activeClasses: ['active'],
        })}>
          <a ${uiSref('mymessages')}>Messages</a>
        </li>
        <li ${uiSrefActive({
          activeClasses: ['active'],
        })}>
          <a ${uiSref('contacts')}>Contacts</a>
        </li>
        <li ${uiSrefActive({
          activeClasses: ['active'],
        })}>
          <a ${uiSref('prefs')}>Preferences</a>
        </li>
        <li class="navbar-right">
          <button ${uiSref('home')} style="margin-right: 5px" class="btn btn-primary fa fa-home"></button>
          <button ${uiSref('mymessages.compose')} style="margin-right: 15px" class="btn btn-primary"><i class="fa fa-envelope"></i> New Message</button>
        </li>

        <li class="navbar-text navbar-right logged-in-user" style="margin: 0.5em 1.5em">
          <div>
            ${emailAddress} <i class="fa fa-chevron-down"></i>
            <div class="hoverdrop">
              <button class="btn btn-primary" @click=${this.handleLogout}>Log Out</button>
            </div>
          </div>
        </li>
      </ul>
    `;
    return html`${
      when(
        isAuthenticated,
        () => navbar,
        () => html`<span></span>`
      )
    }`;
  }
}

export default NavHeader;
