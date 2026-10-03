// oxlint jsPlugins fixture for `allowElementParts: false`, which the
// `prerendered/**` override sets: element parts count for nothing here.
import { html } from 'lit';
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

export const elementPart = html`<a ${uiSref('home')}>Home</a>`;
export const active = html`<a href="/home" ${uiSrefActive({})}>Home</a>`;

export const served = html`<a
  href=${srefHref('home')}
  class=${srefActiveClass({ state: 'home' })}
  aria-current=${srefAriaCurrent({ state: 'home' })}
  >Home</a
>`;
