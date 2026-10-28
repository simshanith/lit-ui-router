import { prefsTable } from 'sample-app-routes/state-table/prefs';
import type { AssertNoCollisions, StatesOf } from 'ui-router-registry';

import { bindStates } from '../../registry/bind.js';
import type { RegisteredRows } from '../../registry/states.js';
import Preferences from './Preferences.js';

/** The prefs module's states, bound by name to its table. */
export const states = bindStates(prefsTable, {
  /**
   * This state allows the user to set their application preferences
   */
  prefs: {
    component: Preferences,
    // Mark this state as requiring authentication.  See ../global/requiresAuth.hook.js.
    data: { requiresAuth: true, title: 'Preferences' },
  },
});

// Registered here, not in the table package, which can't name the param types RegisteredRows adds.
type Rows = RegisteredRows<typeof prefsTable>;

declare module 'ui-router-registry' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- the members come from StatesOf
  interface RegisteredStates extends StatesOf<Rows> {}
}

/** The prefs module's rows, each the one registered under its name. */
export type PrefsStates = AssertNoCollisions<Rows>;
