import { html, render } from 'lit';
import { hashLocationPlugin, type Transition } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
  type RoutedLitTemplate,
} from 'lit-ui-router';

import './hex-badge';
import shell from './shell.module.css';
import list from './swatch-list.module.css';
import detail from './swatch-detail.module.css';
import { SWATCHES, findSwatch, type Swatch } from './swatches';

// Routed views render into <ui-view>'s light DOM, so a global sheet with hashed class names styles them.
const SwatchList: RoutedLitTemplate = () => html`
  <div class=${list.layout}>
    <ul class=${list.list}>
      ${SWATCHES.map(
        (swatch) => html`
          <li>
            <a
              class=${list.item}
              style="--swatch: ${swatch.hex}"
              ${uiSrefActive({ activeClasses: [list.selected] })}
              ${uiSref('swatches.swatch', { id: swatch.id })}
            >
              <span class=${list.chip}></span>${swatch.name}
            </a>
          </li>
        `,
      )}
    </ul>
    <ui-view><p>Pick a pigment.</p></ui-view>
  </div>
`;

const SwatchDetail: RoutedLitTemplate = ({ resolves }) => {
  // SAFETY: the swatches.swatch state's `swatch` resolve supplies this value
  const swatch = resolves.swatch as Swatch;

  return html`
    <article class=${detail.card} style="--swatch: ${swatch.hex}">
      <div class=${detail.plate}></div>
      <h3 class=${detail.title}>
        ${swatch.name} <hex-badge hex=${swatch.hex}></hex-badge>
      </h3>
      <p>${swatch.note}</p>
      <p class=${detail.code}>class="${detail.card}"</p>
    </article>
  `;
};

const About: RoutedLitTemplate = () => html`
  <p>
    Every class on this page comes from a <code>*.module.css</code> file. Vite
    rewrites each one to a scoped name and hands the component a map of them, so
    <code>.active</code> in the shell and <code>.selected</code> in the list
    never meet.
  </p>
`;

const states: LitStateDeclaration[] = [
  { name: 'swatches', url: '/swatches', component: SwatchList },
  {
    name: 'swatches.swatch',
    url: '/:id',
    component: SwatchDetail,
    resolve: [
      {
        token: 'swatch',
        deps: ['$transition$'],
        resolveFn: ($transition$: Transition) =>
          findSwatch($transition$.params<{ id: string }>().id) ??
          Promise.reject(new Error('unknown swatch')),
      },
    ],
  },
  { name: 'about', url: '/about', component: About },
];

const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

states.forEach((state) => router.stateRegistry.register(state));

router.urlService.rules.initial({ state: 'swatches' });

router.start();

const link = (state: string, label: string) => html`
  <a
    class=${shell.link}
    ${uiSrefActive({ activeClasses: [shell.active] })}
    ${uiSref(state)}
    >${label}</a
  >
`;

render(
  html`
    <ui-router .uiRouter=${router}>
      <div class=${shell.shell}>
        <nav class=${shell.nav} aria-label="CSS Modules">
          ${link('swatches', 'Swatches')} ${link('about', 'About')}
        </nav>
        <ui-view></ui-view>
      </div>
    </ui-router>
  `,
  document.getElementById('root')!,
);
