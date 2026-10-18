/**
 * Every state the sample apps register, eagerly or from a future state's
 * module. A type-only import keeps the lazy modules lazy.
 */
import type appStates from '../app/main/states.js';
import type { states as contactsStates } from '../app/contacts/states.js';
import type { states as mymessagesStates } from '../app/mymessages/states.js';
import type { states as prefsStates } from '../app/prefs/states.js';

export type SampleAppStates =
  | (typeof appStates)[number]
  | (typeof contactsStates)[number]
  | (typeof mymessagesStates)[number]
  | (typeof prefsStates)[number];
