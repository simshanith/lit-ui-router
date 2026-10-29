// `tsc --noEmit` is the assertion: the sref directives read `ui-router-registry`'s
// `Register`, augmented below, through the package's public entry point.
import {
  srefActiveClass,
  srefAriaCurrent,
  srefHref,
  SrefStatusController,
  type SrefTarget,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';
import type { UncheckedRef } from 'ui-router-registry';

const states = [
  { name: 'home', url: '/home' },
  { name: 'contacts', url: '/contacts' },
  { name: 'contacts.contact', url: '/:contactId' },
  { name: 'contacts.contact.edit', url: '/edit' },
  { name: 'messages', url: '/messages' },
  { name: 'messages.list', url: '/:folderId', params: { folderId: 'inbox' } },
  { name: 'messages.list.message', url: '/{messageId:int}' },
  { name: 'search', url: '/search?q&{page:int}' },
] as const;

declare module 'ui-router-registry' {
  interface Register {
    states: (typeof states)[number];
  }
}

declare function accepts<T>(value: T): T;

declare const status: SrefStatusController;

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

declare const host: ConstructorParameters<typeof SrefStatusController>[0];

new SrefStatusController(host, {
  // @ts-expect-error a misspelled state name
  state: 'contcts',
});
