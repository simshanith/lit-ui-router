import { html, nothing, render } from 'lit';
import { UIRouterLit } from 'lit-ui-router';

import {
  replaceAwareHashLocationPlugin,
  type ReplaceAwareHashLocationOptions,
} from './replace-aware-hash-location.ts';
import { cardState, INITIAL_CARD } from './tour.ts';

/**
 * Runs the tour inside a host page, in `container`, on the fragments the
 * prefix names. main.ts runs the same tour as a page of its own.
 *
 * Returns a function that removes the tour and stops its router listening; a
 * host with client-side navigation calls it when the page goes away.
 */
export function mountTour(
  container: HTMLElement,
  options: Pick<ReplaceAwareHashLocationOptions, 'prefix'> = {},
): () => void {
  const router = new UIRouterLit();

  // The default replace strategy keeps the host page's history.state on the entry.
  router.plugin(replaceAwareHashLocationPlugin, options);

  router.stateRegistry.register(cardState);

  // location: false leaves the page's URL as it was opened; the first move writes the fragment.
  router.urlService.rules.initial({
    ...INITIAL_CARD,
    options: { location: false },
  });

  router.start();

  render(
    html`
      <ui-router .uiRouter=${router}>
        <app-root></app-root>
      </ui-router>
    `,
    container,
  );

  return () => {
    render(nothing, container);
    router.dispose();
  };
}
