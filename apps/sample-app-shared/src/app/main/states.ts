import { Transition } from '@uirouter/core';
import { LitStateDeclaration } from 'lit-ui-router';

import { App } from '../global/appModules.js';
import Welcome from '../main/Welcome.js';
import Login from '../main/Login.js';
import Home from '../main/Home.js';
import NotFound from '../main/NotFound.js';
import { routeSegments } from '../routes.js';

/**
 * This is the parent state for the entire application.
 *
 * This state's primary purposes are:
 * 1) Shows the outermost chrome (including the navigation and logout for authenticated users)
 * 2) Provide a viewport (ui-view) for a substate to plug into
 */
export class AppState implements LitStateDeclaration {
  name = 'app';
  redirectTo = 'welcome';
  component = App;
  static __uiRouterState = true;
}

/**
 * This is the 'welcome' state.  It is the default state (as defined by app.js) if no other state
 * can be matched to the URL.
 */
const welcomeState = {
  parent: 'app',
  name: 'welcome',
  url: routeSegments.welcome,
  component: Welcome,
};

/**
 * This is a home screen for authenticated users.
 *
 * It shows giant buttons which activate their respective submodules: Messages, Contacts, Preferences
 */
const homeState = {
  parent: 'app',
  name: 'home',
  url: routeSegments.home,
  component: Home,
};

/**
 * This is the login state.  It is activated when the user navigates to /login, or if a unauthenticated
 * user attempts to access a protected state (or substate) which requires authentication. (see routerhooks/requiresAuth.js)
 *
 * It shows a fake login dialog and prompts the user to authenticate.  Once the user authenticates, it then
 * reactivates the state that the user originally came from.
 */
const loginState = {
  parent: 'app',
  name: 'login',
  url: routeSegments.login,
  component: Login,
  resolve: [
    {
      token: 'returnTo',
      deps: ['$transition$'],
      resolveFn: returnTo,
    },
  ],
};

/**
 * A resolve function for 'login' state which figures out what state to return to, after a successful login.
 *
 * If the user was initially redirected to login state (due to the requiresAuth redirect), then return the toState/params
 * they were redirected from.  Otherwise, if they transitioned directly, return the fromState/params.  Otherwise
 * return the main "app" state.
 */
function returnTo($transition$: Transition) {
  if ($transition$.redirectedFrom()) {
    // The user was redirected to the login state (e.g., via the requiresAuth hook when trying to activate contacts)
    // Return to the original attempted target state (e.g., contacts)
    return $transition$.redirectedFrom().targetState();
  }

  const $state = $transition$.router.stateService;

  // The user was not redirected to the login state; they directly activated the login state somehow.
  // Return them to the state they came from.
  if ($transition$.from().name !== '') {
    return $state.target($transition$.from(), $transition$.params('from'));
  }

  // If the fromState's name is empty, then this was the initial transition. Just return them to the home state
  return $state.target('home');
}

/**
 * This is the 404 state. The `urlService.rules.otherwise` rule in
 * router.config.ts targets it when no other URL rule matches — including the
 * future states' wildcard rules below, so lazy loading still wins when a URL
 * matches a future state's prefix.
 *
 * It intentionally declares no `url`: the unmatched URL stays in the address
 * bar (like a server 404) and the state can only be activated by the rule.
 */
export const notFoundState = {
  parent: 'app',
  name: 'notFound',
  params: { attemptedPath: null },
  resolve: [
    {
      token: 'attemptedPath',
      deps: ['$transition$'],
      resolveFn: ($transition$: Transition) =>
        // RawParams values are `any`; attemptedPath is declared `null` above.
        $transition$.params().attemptedPath as string | null,
    },
  ],
  component: NotFound,
};

// Future State (Placeholder) for the contacts module
export const contactsFutureState = {
  parent: 'app',
  name: 'contacts.**',
  url: routeSegments.contacts,
  lazyLoad: () => import('../contacts/states.js'),
};

// Future State (Placeholder) for the prefs module
export const prefsFutureState = {
  parent: 'app',
  name: 'prefs.**',
  url: routeSegments.prefs,
  lazyLoad: () => import('../prefs/states.js'),
};

// Future State (Placeholder) for the mymessages module
export const mymessagesFutureState = {
  parent: 'app',
  name: 'mymessages.**',
  url: routeSegments.mymessages,
  lazyLoad: () => import('../mymessages/states.js'),
};

export default [
  AppState,
  welcomeState,
  homeState,
  loginState,
  notFoundState,
  contactsFutureState,
  prefsFutureState,
  mymessagesFutureState,
];
