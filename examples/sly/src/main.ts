import { css, html, render } from 'lit';
import { hashLocationPlugin, type Transition } from '@uirouter/core';
import { shadowView, useCss, useName } from '@e280/sly';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
} from 'lit-ui-router';

import { findSwatch, type Swatch } from './swatches';
import { $starred, SwatchDetail, SwatchList } from './views';

const Shell = shadowView(() => {
  useName('app-shell');
  useCss(css`
    nav {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
    }
    nav a {
      padding: 6px 14px;
      border-radius: 999px;
      color: inherit;
      text-decoration: none;
    }
    nav a.active {
      font-weight: 600;
      background: light-dark(#0000001a, #ffffff26);
    }
  `);

  return html`
    <nav aria-label="sly">
      <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('swatches')}
        >Swatches</a
      >
      <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('about')}
        >About (${$starred().length} starred)</a
      >
    </nav>
    <ui-view></ui-view>
  `;
});

// A routed component returns a TemplateResult, so each sly view is wrapped in html``.
const states: LitStateDeclaration[] = [
  {
    name: 'swatches',
    url: '/swatches',
    component: () => html`${SwatchList()}`,
  },
  {
    name: 'swatches.swatch',
    url: '/:id',
    component: ({ resolves }) =>
      // SAFETY: this state's `swatch` resolve supplies the value
      html`${SwatchDetail(resolves.swatch as Swatch)}`,
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
  {
    name: 'about',
    url: '/about',
    component: () => html`
      <p>
        Every box on this page is a
        <a href="https://github.com/e280/sly">sly</a>
        shadow view: a hooks function with its own shadow root. lit-ui-router
        routes between them, and its links work from inside each shadow root.
      </p>
    `,
  },
];

const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

states.forEach((state) => router.stateRegistry.register(state));

router.urlService.rules.initial({ state: 'swatches' });

router.start();

render(
  html`<ui-router .uiRouter=${router}>${Shell()}</ui-router>`,
  document.getElementById('root')!,
);
