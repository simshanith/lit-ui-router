import { html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { TransitionController, uiSref, uiSrefActive } from 'lit-ui-router';

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

  // Disclosure state for the logged-in-user menu; :hover still reveals it too.
  @state()
  private userMenuOpen = false;

  @query('.logged-in-user .disclosure')
  private readonly disclosure?: HTMLElement | null;

  @query('.logged-in-user .disclosure-toggle')
  private readonly disclosureToggle?: HTMLButtonElement | null;

  // `focusout` is bound here rather than in the template: lit-analyzer's
  // no-unknown-event doesn't know the event, and the rule is a repo-wide error.
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('focusout', this.handleUserMenuFocusout);
  }

  disconnectedCallback() {
    this.removeEventListener('focusout', this.handleUserMenuFocusout);
    super.disconnectedCallback();
  }

  handleLogout() {
    this.userMenuOpen = false;
    this.dispatchEvent(new Event('logout'));
  }

  private toggleUserMenu() {
    this.userMenuOpen = !this.userMenuOpen;
  }

  // Escape closes the disclosure and returns focus to its trigger.
  private handleUserMenuKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !this.userMenuOpen) return;
    this.userMenuOpen = false;
    this.disclosureToggle?.focus();
  }

  // Focus leaving the widget closes it, so it can't stay stuck open.
  private readonly handleUserMenuFocusout = (event: FocusEvent) => {
    const widget = this.disclosure;
    const next = event.relatedTarget;
    if (!widget || (next instanceof Node && widget.contains(next))) return;
    this.userMenuOpen = false;
  };

  render() {
    const isAuthenticated = AuthService.isAuthenticated();
    const { emailAddress } = AppConfig;
    const chevron = this.userMenuOpen ? 'fa-chevron-up' : 'fa-chevron-down';
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

        <li
          class="navbar-text navbar-right logged-in-user"
          style="margin: 0.5em 1.5em"
        >
          <div class="disclosure" @keydown=${this.handleUserMenuKeydown}>
            <button
              type="button"
              class="disclosure-toggle"
              aria-expanded=${this.userMenuOpen ? 'true' : 'false'}
              aria-controls="logged-in-user-menu"
              @click=${this.toggleUserMenu}
            >
              ${emailAddress} <i class="fa ${chevron}"></i>
            </button>
            <div class="hoverdrop" id="logged-in-user-menu">
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
