import { Transition } from '@uirouter/core';

import { App } from '../global/appModules.js';
import { appTable } from 'sample-app-routes/state-table/app';
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';

import { bindStates, futureState } from '../../registry/bind.js';
import type { RegisteredRows } from '../../registry/states.js';
import Welcome from '../main/Welcome.js';
import Login from '../main/Login.js';
import Home from '../main/Home.js';
import NotFound from '../main/NotFound.js';

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
 * The eagerly registered states. Their names, urls, params and parents come
 * from the app table (`sample-app-routes/state-table/app`), as do the future
 * states'; everything else binds here by name. Built at boot, after the app registers `App`.
 */
export default function appStates() {
  return [
    ...bindStates(appTable, {
      /**
       * This is the parent state for the entire application.
       *
       * This state's primary purposes are:
       * 1) Shows the outermost chrome (including the navigation and logout for authenticated users)
       * 2) Provide a viewport (ui-view) for a substate to plug into
       */
      app: { component: App },
      /**
       * This is the 'welcome' state.  It is the default state (as defined by app.js) if no other state
       * can be matched to the URL.
       */
      welcome: { component: Welcome, data: { title: 'Welcome' } },
      /**
       * This is a home screen for authenticated users.
       *
       * It shows giant buttons which activate their respective submodules: Messages, Contacts, Preferences
       */
      home: { component: Home, data: { title: 'Home' } },
      /**
       * This is the login state.  It is activated when the user navigates to /login, or if a unauthenticated
       * user attempts to access a protected state (or substate) which requires authentication. (see routerhooks/requiresAuth.js)
       *
       * It shows a fake login dialog and prompts the user to authenticate.  Once the user authenticates, it then
       * reactivates the state that the user originally came from.
       */
      login: {
        component: Login,
        data: { title: 'Log in' },
        resolve: { returnTo: { deps: ['$transition$'], resolveFn: returnTo } },
      },
      /**
       * This is the 404 state. The `urlService.rules.otherwise` rule in
       * router.config.ts targets it when no other URL rule matches — including the
       * future states' wildcard rules below, so lazy loading still wins when a URL
       * matches a future state's prefix.
       *
       * The table gives it no `url`: the unmatched URL stays in the address
       * bar (like a server 404) and the state can only be activated by the rule.
       */
      notFound: {
        data: { title: 'Page not found' },
        resolve: {
          attemptedPath: {
            deps: ['$transition$'],
            resolveFn: ($transition$: Transition) =>
              // SAFETY: the table declares attemptedPath `null`; the otherwise rule sets a path string
              $transition$.params().attemptedPath as string | null,
          },
        },
        component: NotFound,
      },
    }),
    // Future State (Placeholder) for each lazily loaded module
    futureState('contacts.**', () => import('../contacts/states.js')),
    futureState('prefs.**', () => import('../prefs/states.js')),
    futureState('mymessages.**', () => import('../mymessages/states.js')),
  ];
}

// Registered here, not in the table package, which can't name the param types RegisteredRows adds.
type Rows = RegisteredRows<typeof appTable>;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<Rows> {}
}

/** The app module's rows, each the one registered under its name. */
export type AppStates = AssertNoCollisions<Rows>;
