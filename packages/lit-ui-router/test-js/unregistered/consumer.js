// @ts-check
// Nothing registers in this program, so every target keeps `string` and `RawParams`.
import { uiSref } from 'lit-ui-router';

/** @param {string} name */
export function links(name) {
  const directive = uiSref;

  return [
    uiSref('contacts.contact', { contactId: 'c1' }),
    uiSref(name, { anything: 1 }),
    uiSref('.child'),
    uiSref('^', {}, { assignHref: 'auto' }),
    directive('home'),
    ['home', 'about'].map((state) => uiSref(state)),
  ];
}
