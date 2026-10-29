// `tsc --noEmit` is the assertion: two modules augment `ui-router-registry`'s
// `RegisteredStates`, none augments `Register`, and this file, which imports
// neither module, sees both.
import {
  srefActiveClass,
  srefHref,
  SrefStatusController,
  type SrefTarget,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

declare function accepts<T>(value: T): T;

declare const status: SrefStatusController;

accepts<SrefTarget>('contacts.contact');

accepts<SrefTarget>('messages.list.message');

// @ts-expect-error a misspelled state name
accepts<SrefTarget>('contcts');

// -- uiSref -------------------------------------------------------------------

uiSref('contacts.contact', { contactId: 'c1' }, { assignHref: 'auto' });

uiSref('messages.list.message', { folderId: 'sent', messageId: 2 });

// A child one module registers under another module's state takes both modules' params.
uiSref('contacts.contact.messages', { contactId: 'c1', page: 2 });

// @ts-expect-error a misspelled state name
uiSref('mesages');

// @ts-expect-error a missing required param from the parent's module
uiSref('contacts.contact.messages', { page: 2 });

// @ts-expect-error a wrong param type: `{messageId:int}` is a number
uiSref('messages.list.message', { messageId: '2' });

// Relative refs: the tail is checked against every module's names.
uiSref('.messages', { anything: 1 });

// @ts-expect-error a relative tail that ends no registered name
uiSref('.mesages');

// -- srefHref and object targets ----------------------------------------------

srefHref('contacts.contact.edit', { contactId: 'c1' });

// @ts-expect-error a missing required param
srefHref('contacts.contact.edit');

uiSrefActive({ state: 'messages.list', params: { folderId: 'sent' } });

// @ts-expect-error a misspelled state name
srefActiveClass({ state: 'contcts', activeClasses: ['active'] });

status.retarget({ state: 'contacts.contact', params: { contactId: 'c2' } });

// @ts-expect-error a misspelled state name
status.retarget({ state: 'mesages' });
