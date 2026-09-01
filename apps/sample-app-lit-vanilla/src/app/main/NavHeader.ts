import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { TransitionController, uiSref, uiSrefActive } from 'lit-ui-router';

import 'sample-app-shared/app/main/UserMenu.js';
import AppConfig from '../global/appConfig.js';
import AuthService from '../global/authService.js';

@customElement('sample-nav-header')
export class NavHeader extends LitElement {
  createRenderRoot() {
    return this;
  }

  // AuthService/AppConfig are plain singletons with no change notification,
  // but auth changes always ride a transition (login/logout navigate), so
  // re-rendering on every successful transition keeps this header fresh.
  transitions = new TransitionController(this);

  handleLogout() {
    this.dispatchEvent(new Event('logout'));
  }

  render() {
    const isAuthenticated = AuthService.isAuthenticated();
    const { emailAddress } = AppConfig;
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
            style="margin-right: 5px"
            class="btn btn-primary fa fa-home"
            aria-label="Home"
          ></a>
          <a
            ${uiSref('mymessages.compose')}
            style="margin-right: 15px"
            class="btn btn-primary"
          >
            <i class="fa fa-envelope"></i> New Message
          </a>
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
