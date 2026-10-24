// @ts-check
// Nothing registers in this program, so every target keeps today's `string` and `RawParams`.
import { uiSref } from 'lit-ui-router';

/**
 * @param {string} name
 * @param {import('ui-router-registry').TypedStateService} stateService
 */
export function links(name, stateService) {
  const directive = uiSref;

  return [
    uiSref('contacts.contact', { contactId: 'c1' }),
    uiSref(name, { anything: 1 }),
    uiSref('.child'),
    uiSref('^', {}, { assignHref: 'auto' }),
    directive('home'),
    ['home', 'about'].map((state) => uiSref(state)),
    stateService.go('anywhere', { anything: 1 }),
    stateService.go(name),
  ];
}
