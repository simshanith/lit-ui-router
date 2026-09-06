import { html, LitElement } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

export function logoutEvent() {
  return new Event('logout');
}

export type LogoutEvent = ReturnType<typeof logoutEvent>;

/**
 * The logged-in user's email as a WAI-ARIA disclosure: the trigger is a real
 * button, so Enter/Space toggle natively, Escape closes and restores focus,
 * and focus leaving the widget closes it. `:hover` still reveals the panel for
 * mouse users (see `.hoverdrop` in styles.css).
 */
@customElement('sample-user-menu')
export class UserMenu extends LitElement {
  createRenderRoot() {
    return this;
  }

  // AppConfig.emailAddress is optional until the user logs in.
  @property({ attribute: false })
  emailAddress: string | undefined = '';

  // Local view state, not a store concern: the apps' reactivity (transitions,
  // MobX) drives `emailAddress`; whether the panel is open is this element's.
  @state()
  private open = false;

  @query('.disclosure-toggle')
  private readonly toggleButton?: HTMLButtonElement | null;

  // Both listeners are bound here rather than in the template: lit-analyzer's
  // no-unknown-event doesn't know `focusout`, and the rule is a repo-wide error.
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this.handleKeydown);
    this.addEventListener('focusout', this.handleFocusout);
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this.handleKeydown);
    this.removeEventListener('focusout', this.handleFocusout);
    super.disconnectedCallback();
  }

  private readonly handleToggle = () => {
    this.open = !this.open;
  };

  private readonly handleLogout = () => {
    this.open = false;
    this.dispatchEvent(logoutEvent());
  };

  // Escape closes the disclosure and returns focus to its trigger.
  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.open) return;
    this.open = false;
    this.toggleButton?.focus();
  };

  // Focus leaving the widget closes it, so it can't stay stuck open.
  private readonly handleFocusout = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    this.open = false;
  };

  render() {
    const chevron = this.open ? 'fa-chevron-up' : 'fa-chevron-down';
    return html`<button
        type="button"
        class="disclosure-toggle"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-controls="logged-in-user-menu"
        @click=${this.handleToggle}
      >
        ${this.emailAddress} <i class="fa ${chevron}"></i>
      </button>
      <div class="hoverdrop" id="logged-in-user-menu">
        <button class="btn btn-primary" @click=${this.handleLogout}>
          Log Out
        </button>
      </div>`;
  }
}

export default UserMenu;
