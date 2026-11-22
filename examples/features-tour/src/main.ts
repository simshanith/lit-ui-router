import { html, render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit } from 'lit-ui-router';

import { cardState, INITIAL_CARD } from './tour.ts';

// The tour as a page of its own: the whole fragment is the router's. embed.ts runs the same tour inside a host page.
const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

router.stateRegistry.register(cardState);

router.urlService.rules.initial(INITIAL_CARD);

router.start();

// Render
render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root')!,
);
