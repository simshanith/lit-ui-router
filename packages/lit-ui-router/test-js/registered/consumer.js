// @ts-check
// The JavaScript half: `register.ts` registers, and checkJs applies the registry here too.
import { uiSref } from 'lit-ui-router';

/** @param {string} name */
export function links(name) {
  return [
    uiSref('contacts.contact', { contactId: 'c1' }),
    uiSref('.edit'),
    uiSref('^'),
    // @ts-expect-error a misspelled state name
    uiSref('contcts.contact', { contactId: 'c1' }),
    // @ts-expect-error a missing required param
    uiSref('contacts.contact', {}),
    // @ts-expect-error a relative ref whose tail ends no registered name
    uiSref('.edti'),
    // @ts-expect-error a widened string fails once the app registers
    uiSref(name),
    uiSref(/** @type {import('ui-router-registry').UncheckedRef} */ (name), {
      anything: 1,
    }),
  ];
}
