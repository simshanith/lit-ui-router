import { html, nothing, render } from 'lit';
import { UIRouterLit } from 'lit-ui-router';

import {
  replaceAwareHashLocationPlugin,
  type ReplaceAwareHashLocationOptions,
} from './replace-aware-hash-location.ts';
import { cardResolves, cardState, INITIAL_CARD, type Card } from './tour.ts';

export interface MountTourOptions extends Pick<
  ReplaceAwareHashLocationOptions,
  'prefix'
> {
  /** The card heading's level in the host page's outline, such as 4 under an <h3>. */
  headingLevel?: number;
  /** Called with each card the router enters, the first included: the host follows the router, not the fragment. */
  onCard?: (card: Pick<Card, 'id' | 'title'>) => void;
}

/**
 * Runs the tour inside a host page, in `container`, on the fragments the
 * prefix names. main.ts runs the same tour as a page of its own.
 *
 * Returns a function that removes the tour and stops its router listening; a
 * host with client-side navigation calls it when the page goes away.
 */
export function mountTour(
  container: HTMLElement,
  { prefix, headingLevel, onCard }: MountTourOptions = {},
): () => void {
  const router = new UIRouterLit();

  // The default replace strategy keeps the host page's history.state on the entry.
  router.plugin(replaceAwareHashLocationPlugin, { prefix });

  router.stateRegistry.register({
    ...cardState,
    // One more input for the routed card: its heading's level in this page.
    resolve: [
      ...cardResolves,
      { token: 'headingLevel', resolveFn: () => headingLevel },
    ],
  });

  router.transitionService.onSuccess({ to: cardState.name }, (transition) => {
    const { id, title } = transition.injector().get<Card>('card');

    onCard?.({ id, title });
  });

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
