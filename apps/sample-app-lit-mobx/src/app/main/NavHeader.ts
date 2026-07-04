import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { comparer } from 'mobx';
import { uiSref, uiSrefActive } from 'lit-ui-router';
import { ReactionController } from 'lit-ui-router-mobx';

import AppConfig from '../global/appConfig.js';
import AuthService from '../global/authService.js';

@customElement('sample-nav-header')
export class NavHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  // Observes the auth state (AppConfig.emailAddress is a MobX observable);
  // logging in or out re-renders this header with no manual requestUpdate()
  // plumbing. Active tab highlighting is handled by uiSrefActive.
  private auth = new ReactionController(
    this,
    () => ({
      isAuthenticated: AuthService.isAuthenticated(),
      emailAddress: AppConfig.emailAddress,
    }),
    { equals: comparer.structural },
  );

  handleLogout() {
    this.dispatchEvent(new Event('logout'));
  }

  render() {
    const { isAuthenticated, emailAddress } = this.auth.value;
    const navbar = html`
      <ul class="nav nav-tabs">
        <li
          ${uiSrefActive({
            activeClasses: ['active'],
          })}
        >
          <a ${uiSref('mymessages')}>Messages</a>
        </li>
        <li
          ${uiSrefActive({
            activeClasses: ['active'],
          })}
        >
          <a ${uiSref('contacts')}>Contacts</a>
        </li>
        <li
          ${uiSrefActive({
            activeClasses: ['active'],
          })}
        >
          <a ${uiSref('prefs')}>Preferences</a>
        </li>
        <li class="navbar-right">
          <button
            ${uiSref('home')}
            style="margin-right: 5px"
            class="btn btn-primary fa fa-home"
          ></button>
          <button
            ${uiSref('mymessages.compose')}
            style="margin-right: 15px"
            class="btn btn-primary"
          >
            <i class="fa fa-envelope"></i> New Message
          </button>
        </li>

        <li
          class="navbar-text navbar-right logged-in-user"
          style="margin: 0.5em 1.5em"
        >
          <div>
            ${emailAddress} <i class="fa fa-chevron-down"></i>
            <div class="hoverdrop">
              <button class="btn btn-primary" @click=${this.handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        </li>
      </ul>
    `;
    return html`${when(
      isAuthenticated,
      () => navbar,
      () => html`<span></span>`,
    )}`;
  }
}

export default NavHeader;
