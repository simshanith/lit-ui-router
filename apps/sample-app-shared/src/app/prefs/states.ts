import Preferences from './Preferences.js';
import { routeSegments } from 'sample-app-routes';
/**
 * This state allows the user to set their application preferences
 */
const prefsState = {
  parent: 'app',
  name: 'prefs',
  url: routeSegments.prefs,
  component: Preferences,
  // Mark this state as requiring authentication.  See ../global/requiresAuth.hook.js.
  data: { requiresAuth: true },
};

export const states = [prefsState];
