// oxlint jsPlugins fixture for the option-aware rules: one report each, then
// the documented fix for each, which must stay quiet.
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

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
