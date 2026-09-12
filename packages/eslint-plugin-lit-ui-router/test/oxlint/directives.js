// oxlint jsPlugins fixture for the option-aware rules: one report each, then
// the documented fix for each, which must stay quiet.
import { html } from 'lit';
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  SrefStatusController,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

export const bareButton = html`<button ${uiSref('home')}>Home</button>`;
export const takeover = html`<a
  href="/home"
  aria-current="page"
  ${uiSrefActive({})}
  >Home</a
>`;
export const misplaced = html`<a href=${uiSref('home')}>Home</a>`;

export const fixedButton = html`<button
  ${uiSref('home', {}, { assignHref: 'auto' })}
>
  Home
</button>`;
export const fixedTakeover = html`<a
  href="/home"
  aria-current="page"
  ${uiSrefActive({ ariaCurrentValue: false })}
  >Home</a
>`;
export const fixedPlacement = html`<a href="/home" ${uiSref('home')}>Home</a>`;

// resolves through scope: this uiSref is the parameter, not the import
export const shadowed = (uiSref) => html`<a href=${uiSref('home')}>Home</a>`;
export const notLit = (html) => html`<a href=${uiSref('home')}>Home</a>`;

// the attribute-part directives: a misplaced one each, then their bindings
export const misboundHref = html`<span ${srefHref('home')}>Home</span>`;
export const misboundClass = html`<a
  part=${srefActiveClass({})}
  ${uiSref('home')}
  >Home</a
>`;

export const fixedHref = html`<a href=${srefHref('home')}>Home</a>`;
export const fixedClass = html`<a
  class="nav ${srefActiveClass({})}"
  aria-current=${srefAriaCurrent({})}
  ${uiSref('home')}
  >Home</a
>`;
export const fixedAriaCurrent = html`<a
  href=${srefHref('home')}
  aria-current=${srefAriaCurrent({})}
  >Home</a
>`;

// painted active, silent to assistive technology, then the documented fix
export const silentActive = html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home' })}
  >Home</a
>`;
export const spokenActive = html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home' })}
  aria-current=${srefAriaCurrent({ state: 'home' })}
  >Home</a
>`;

// the controller channel: classes composed from status, then the same link told
export class NavBar {
  users = new SrefStatusController(this, { state: 'users' });

  silent() {
    return html`<a
      href=${srefHref('users')}
      class="nav ${this.users.active ? 'on' : ''}"
      >Users</a
    >`;
  }

  spoken() {
    return html`<a
      href=${srefHref('users')}
      class="nav ${this.users.active ? 'on' : ''}"
      aria-current=${this.users.ariaCurrent()}
      >Users</a
    >`;
  }
}
