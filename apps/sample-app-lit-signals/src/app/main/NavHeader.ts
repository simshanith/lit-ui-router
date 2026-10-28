import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { SignalWatcher } from '@lit-labs/signals';
import { uiSrefActive } from 'lit-ui-router';
import { uiSref } from 'sample-app-shared/registry/lit.js';

import 'sample-app-shared/app/main/UserMenu.js';
import AppConfig from '../global/appConfig.js';
import AuthService from '../global/authService.js';

// SignalWatcher tracks every signal render() reads (AppConfig.emailAddress
// here), so logging in or out re-renders this header with no controller.
// Active tab highlighting is handled by uiSrefActive.
@customElement('sample-nav-header')
export class NavHeader extends SignalWatcher(LitElement) {
  createRenderRoot() {
    return this;
  }

  handleLogout() {
    this.dispatchEvent(new Event('logout'));
  }

  render() {
    const isAuthenticated = AuthService.isAuthenticated();
    const emailAddress = AppConfig.emailAddress;

    const navbar = html`
      <nav aria-label="Main">
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
          <!-- one li, children in visual order: float stacking used to reverse
               two lis, so tab order zigzagged back to the menu (WCAG 2.4.3) -->
          <li class="navbar-right">
            <sample-user-menu
              class="logged-in-user"
              .emailAddress=${emailAddress}
              @logout=${this.handleLogout}
            ></sample-user-menu>
            <a
              ${uiSref('home')}
              style="margin-inline-end: 5px"
              class="btn btn-primary fa fa-home"
              aria-label="Home"
            ></a>
            <a
              ${uiSref('mymessages.compose')}
              style="margin-inline-end: 15px"
              class="btn btn-primary"
            >
              <i class="fa fa-envelope"></i> New Message
            </a>
          </li>
        </ul>
      </nav>
    `;

    return html`${when(
      isAuthenticated,
      () => navbar,
      () => html`<span></span>`,
    )}`;
  }
}

export default NavHeader;
