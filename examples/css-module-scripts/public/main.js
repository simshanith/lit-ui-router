import { html, LitElement, render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit, uiSref, uiSrefActive } from 'lit-ui-router';

import page from './page.css' with { type: 'css' };
import pill from './pill.css' with { type: 'css' };
import swatchList from './swatch-list.css' with { type: 'css' };
import { SWATCHES, findSwatch } from './swatches.js';

// A CSS module script is a CSSStyleSheet: the document and Lit's `static styles` adopt the same object.
document.adoptedStyleSheets = [...document.adoptedStyleSheets, page];

const active = () => uiSrefActive({ activeClasses: ['active'] });

class AppRoot extends LitElement {
  // One parsed sheet, shared by every shadow root that lists it.
  static styles = [pill];

  render() {
    return html`
      <nav aria-label="CSS Module Scripts">
        <a ${active()} ${uiSref('swatches')}>Swatches</a>
        <a ${active()} ${uiSref('about')}>About</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

class SwatchList extends LitElement {
  static styles = [pill, swatchList];

  render() {
    return html`
      <ul>
        ${SWATCHES.map(
          (swatch) => html`
            <li>
              <a
                style="--swatch: ${swatch.hex}"
                ${active()}
                ${uiSref('.swatch', { id: swatch.id })}
              >
                <span class="chip"></span>${swatch.name}
              </a>
            </li>
          `,
        )}
      </ul>
      <ui-view><p>Pick a pigment.</p></ui-view>
    `;
  }
}

customElements.define('app-root', AppRoot);

customElements.define('swatch-list', SwatchList);

/** @type {import('lit-ui-router').RoutedLitTemplate<{ swatch: import('./swatches.js').Swatch }>} */
const SwatchDetail = ({ resolves: { swatch } }) => html`
  <article style="--swatch: ${swatch.hex}">
    <div class="plate"></div>
    <h3>${swatch.name}</h3>
    <p>${swatch.note}</p>
  </article>
`;

const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

/** @type {import('lit-ui-router').LitStateDeclaration[]} */
const states = [
  { name: 'swatches', url: '/swatches', component: SwatchList },
  {
    name: 'swatches.swatch',
    url: '/:id',
    component: /** @type {import('lit-ui-router').RoutedLitTemplate} */ (
      SwatchDetail
    ),
    resolve: [
      {
        token: 'swatch',
        deps: ['$transition$'],
        /** @param {import('@uirouter/core').Transition} $transition$ */
        resolveFn: ($transition$) =>
          findSwatch($transition$.params().id) ??
          Promise.reject(new Error('unknown swatch')),
      },
    ],
  },
  {
    name: 'about',
    url: '/about',
    component: () => html`
      <p>
        Each stylesheet on this page is imported with
        <code>with { type: 'css' }</code>: no bundler, no CSS-in-JS. The browser
        parses it once into a <code>CSSStyleSheet</code> that Lit adopts.
      </p>
    `,
  },
];

states.forEach((state) => router.stateRegistry.register(state));

router.urlService.rules.initial({ state: 'swatches' });

router.start();

render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root') ?? document.body,
);
