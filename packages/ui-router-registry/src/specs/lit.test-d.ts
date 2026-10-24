// `tsc --noEmit` is the assertion: lit-ui-router's own directives, typed by
// `ui-router-registry/lit` through the package's public entry point. The
// `Register` augmentation lives in registry.test-d.ts, in the same program.
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  SrefStatusController,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';
import type { RouteTypes, SrefTarget } from 'lit-ui-router';

import type { RegisteredRouteTypes, UncheckedRef } from '../index.js';
import type {} from '../lit.js';

declare function accepts<T>(value: T): T;

declare const status: SrefStatusController;

declare const routeTypes: RouteTypes;

// -- the augmentation merged through the entry point's re-export -------------

accepts<RegisteredRouteTypes>(routeTypes);

accepts<SrefTarget>('contacts.contact');

// @ts-expect-error a misspelled state name
accepts<SrefTarget>('contcts');

// -- uiSref -------------------------------------------------------------------

uiSref('home');

uiSref('contacts.contact', { contactId: 'c1' }, { assignHref: 'auto' });

uiSref('messages.list.message', { folderId: 'sent', messageId: 2 });

// @ts-expect-error a misspelled state name
uiSref('hom');

// @ts-expect-error a missing required param
uiSref('contacts.contact');

// @ts-expect-error a wrong param type: `{messageId:int}` is a number
uiSref('messages.list.message', { messageId: '2' });

// @ts-expect-error an undeclared param
uiSref('home', { nope: 1 });

// Relative refs: the tail is checked, params stay loose.
uiSref('.edit', { anything: 1 });

uiSref('^.contact', {});

uiSref('^');

// @ts-expect-error a relative tail that ends no registered name
uiSref('.contcat');

// @ts-expect-error a relative tail that ends no registered name
srefHref('^.edti');

// -- unchecked targets ---------------------------------------------------------

declare const runtimeName: string;

// @ts-expect-error a widened string isn't a registered name
uiSref(runtimeName);

// SAFETY: an opt-out on purpose; the name is one the registry can't see
const uncheckedName = runtimeName as UncheckedRef;

uiSref(uncheckedName, { anything: 1 }, { assignHref: 'auto' });

srefHref(uncheckedName);

uiSrefActive({ state: uncheckedName, params: { anything: 1 } });

// -- srefHref -----------------------------------------------------------------

srefHref('search', { q: 'x', page: 2 });

// @ts-expect-error a missing required param
srefHref('contacts.contact.edit');

// -- object targets -----------------------------------------------------------

uiSrefActive({ state: 'contacts.contact', params: { contactId: 'c1' } });

uiSrefActive({ activeClasses: ['active'] });

// @ts-expect-error a misspelled state name
uiSrefActive({ state: 'contcts', activeClasses: ['active'] });

// @ts-expect-error a wrong param type
srefActiveClass({ state: 'messages.list.message', params: { messageId: 'x' } });

srefAriaCurrent({ state: 'messages', value: 'location' });

status.retarget({ state: 'contacts.contact', params: { contactId: 'c2' } });

// @ts-expect-error a misspelled state name
status.retarget({ state: 'contcts' });
