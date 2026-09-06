import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { compareStructural } from 'mobx';
import { uiSref, uiSrefActive } from 'lit-ui-router';
import { ReactionController } from 'lit-ui-router-mobx';

import 'sample-app-shared/app/main/UserMenu.js';
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
  private readonly auth = new ReactionController(
    this,
    () => ({
      isAuthenticated: AuthService.isAuthenticated(),
      emailAddress: AppConfig.emailAddress,
    }),
    { equals: compareStructural },
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
