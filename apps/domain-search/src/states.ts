import type { Transition } from '@uirouter/core';
import type { LitStateDeclaration, UIRouterLit } from 'lit-ui-router/pure';

import { QUERY_PARAM, STORAGE_KEY } from './pre-paint.ts';
import { searchDomains } from './search.ts';
import type { SearchResults } from './search.ts';
import { IdleView, ResultsView, SearchView } from './views.ts';

const queryOf = (transition: Transition): string =>
  String(transition.params()[QUERY_PARAM] ?? '');

const remember = (query: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, query);
  } catch {
    // storage refused: the next visit starts empty
  }
};

// `q` is dynamic, so a keystroke never exits `search` and the input never unmounts.
const search: LitStateDeclaration = {
  name: 'search',
  url: `/domain-search?${QUERY_PARAM}`,
  params: { [QUERY_PARAM]: { dynamic: true, value: null } },
  component: SearchView,
  redirectTo: (transition) => ({
    state: queryOf(transition).trim() ? 'search.results' : 'search.idle',
    params: transition.params(),
  }),
};

const idle: LitStateDeclaration = { name: 'search.idle', component: IdleView };

const results: LitStateDeclaration<{ results: SearchResults }> = {
  name: 'search.results',
  component: ResultsView,
  resolve: [
    {
      token: 'results',
      deps: ['$transition$'],
      resolveFn: (transition: Transition) => searchDomains(queryOf(transition)),
    },
  ],
  onEnter: (transition) => remember(queryOf(transition)),
};

/** Registers the page's states on `router`. */
export const registerStates = (router: UIRouterLit): void => {
  router.stateRegistry.register(search);
  router.stateRegistry.register(idle);
  router.stateRegistry.register(results);
};
