import { html, render } from 'lit';
import { UIRouterLit } from 'lit-ui-router';

import { replaceAwareHashLocationPlugin } from './replace-aware-hash-location.ts';
import { cardState, IN_PLACE, INITIAL_CARD } from './tour.ts';

// The tour as a page of its own: the whole fragment is the router's. embed.ts runs the same tour inside a host page.
const router = new UIRouterLit();

// location.replace, not history.replaceState: the browser fires hashchange, which a page framing this one listens for.
router.plugin(replaceAwareHashLocationPlugin, { replace: 'location.replace' });

router.stateRegistry.register(cardState);

// In place: the empty fragment redirects to the first card without leaving an entry behind it.
router.urlService.rules.initial({ ...INITIAL_CARD, options: IN_PLACE });

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
