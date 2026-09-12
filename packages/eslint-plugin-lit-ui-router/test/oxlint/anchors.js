// oxlint jsPlugins fixture: navigable anchors, two dead ones.
import { html } from 'lit';
import { srefHref, uiSref } from 'lit-ui-router';

export const navigable = html`<a ${uiSref('home')}>Home</a>`;
export const dead = html`<a>Home</a>`;
export const optedOut = html`<a
  ${uiSref('home', undefined, { assignHref: false })}
  >Home</a
>`;

// the attribute-part sibling: the href is the binding itself
export const bound = html`<a href=${srefHref('home')}>Home</a>`;
