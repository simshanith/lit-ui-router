// Not imported anywhere: this module exists to be linted, not run. The
// directive-position cases below throw at render time by design, and
// `eslint . --fix` would silently repair the two fixable ones.
import { html } from 'lit';
import { uiSref, uiSrefActive } from 'lit-ui-router';

// lit-ui-router/sref-assign-href
export const assignHref = html`
  <!-- ✓ GOOD: 'auto' writes the href only where HTML defines one -->
  <button ${uiSref('about', undefined, { assignHref: 'auto' })}>About</button>
  <!-- ✗ BAD: the 1.x default writes an inert href to a <button> -->
  <button ${uiSref('about')}>About</button>
`;

// lit-ui-router/sref-active-aria-current
export const ariaCurrent = html`
  <!-- ✓ GOOD: the directive owns aria-current -->
  <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}>Hello</a>
  <!-- ✗ BAD: the authored aria-current is taken over, then removed -->
  <a
    aria-current="page"
    ${uiSrefActive({ activeClasses: ['active'] })}
    ${uiSref('hello')}
    >Hello</a
  >
`;

// lit-ui-router/directive-position
export const position = html`
  <!-- ✓ GOOD: an element part, the only position uiSref accepts -->
  <a ${uiSref('hello')}>Hello</a>
  <!-- ✗ BAD: an attribute value — the directive throws when it renders -->
  <a href=${uiSref('hello')}>Hello</a>
`;

// lit-ui-router/anchor-is-valid
export const anchorIsValid = html`
  <!-- ✓ GOOD: the uiSref element part counts as the href it assigns -->
  <a ${uiSref('about')}>About</a>
  <!-- ✗ BAD: no href, no directive -->
  <a>About</a>
`;
