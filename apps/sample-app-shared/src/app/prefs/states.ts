import { bindStates } from '../../registry/bind.js';
import Preferences from './Preferences.js';

/** The prefs module's states, bound by name to the shared state table. */
export const states = bindStates({
  /**
   * This state allows the user to set their application preferences
   */
  prefs: {
    component: Preferences,
    // Mark this state as requiring authentication.  See ../global/requiresAuth.hook.js.
    data: { requiresAuth: true, title: 'Preferences' },
  },
});
