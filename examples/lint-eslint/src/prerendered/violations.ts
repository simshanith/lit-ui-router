// Not imported anywhere: these templates stand for ones a server prerenders,
// where `allowElementParts: false` holds them to what the server serves.
import { html } from 'lit';
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

// lit-ui-router/anchor-is-valid
export const anchorIsValid = html`
  <!-- ✓ GOOD: an attribute part, which the server renders as the href -->
  <a href=${srefHref('about')}>About</a>
  <!-- ✗ BAD: the server never runs the element part, so it serves no href -->
  <a ${uiSref('about')}>About</a>
`;

// lit-ui-router/sref-active-class-aria-current
export const activeClassAriaCurrent = html`
  <!-- ✓ GOOD: the server renders the active class and aria-current -->
  <a
    href=${srefHref('hello')}
    class=${srefActiveClass({ state: 'hello' })}
    aria-current=${srefAriaCurrent({ state: 'hello' })}
    >Hello</a
  >
  <!-- ✗ BAD: served with neither, nor the href anchor-is-valid asks for -->
  <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}>Hello</a>
`;
