// oxlint jsPlugins fixture: one navigable anchor, two dead ones.
import { html } from 'lit';
import { uiSref } from 'lit-ui-router';

export const navigable = html`<a ${uiSref('home')}>Home</a>`;
export const dead = html`<a>Home</a>`;
export const optedOut = html`<a
  ${uiSref('home', undefined, { assignHref: false })}
  >Home</a
>`;
