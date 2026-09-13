// Not imported anywhere: this module exists to be linted, not run. The
// directive-position cases below throw at render time by design, and
// `eslint . --fix` would silently repair the four fixable ones.
import { html, LitElement } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import {
  SrefStatusController,
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';
import '@spectrum-web-components/link/sp-link.js';

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

// lit-ui-router/sref-active-class-aria-current
export const activeClassAriaCurrent = html`
  <!-- ✓ GOOD: the attribute part paints the classes, srefAriaCurrent speaks -->
  <a
    href=${srefHref('hello')}
    class=${srefActiveClass({ state: 'hello' })}
    aria-current=${srefAriaCurrent({ state: 'hello' })}
    >Hello</a
  >
  <!-- ✗ BAD: styled active, and silent to assistive technology -->
  <a href=${srefHref('hello')} class=${srefActiveClass({ state: 'hello' })}
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

// settings.linkElements — `sp-link` is declared in eslint.config.js, so
// anchor-is-valid holds it to the <a> bar and sref-assign-href goes quiet on it
export const linkElements = html`
  <!-- ✓ GOOD: the true default assigns the href the element declares -->
  <sp-link ${uiSref('about')}>About</sp-link>
  <!-- ✗ BAD: 'auto' assigns nothing to a tag HTML gives no href, so the link is dead -->
  <sp-link ${uiSref('about', undefined, { assignHref: 'auto' })}>About</sp-link>
`;

// lit-ui-router/sref-status-aria-current — the one pair that needs a host
// class. The controller hands the status to the component, so no directive
// call appears in the template for the attribute-part rule to read.
export class StatusHost extends LitElement {
  hello = new SrefStatusController(this, { state: 'hello' });

  render() {
    return html`
      <!-- ✓ GOOD: ariaCurrent() speaks what classMap paints -->
      <a
        href="/hello"
        class=${classMap({ active: this.hello.active })}
        aria-current=${this.hello.ariaCurrent()}
        >Hello</a
      >
      <!-- ✗ BAD: the host reads the status for CSS and tells no one else -->
      <a href="/hello" class=${classMap({ active: this.hello.active })}
        >Hello</a
      >
    `;
  }
}
