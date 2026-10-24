// Type-level spec for the app's registry wiring: `tsc --noEmit` is the assertion.
import type { StateDeclaration } from '@uirouter/core';
import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  TypedStateService,
} from 'ui-router-registry';
import { uiSref } from 'sample-app-shared/registry/lit.js';

declare const stateService: TypedStateService;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// -- names: registered states, future-state placeholders excluded --------------

accepts<StateName>('contacts.contact.edit');

accepts<StateName>('app');

// @ts-expect-error a misspelled state name
accepts<StateName>('contcts');

// @ts-expect-error a future state's placeholder isn't a target
accepts<StateName>('contacts.**');

void stateService.go('home');

// @ts-expect-error a misspelled state name
void stateService.go('hom');

// @ts-expect-error a misspelled state name
uiSref('mymessages.compse');

// @ts-expect-error a misspelled state name
stateService.href('prefs.x');

// -- required params: url placeholders without a default ----------------------

void stateService.go('contacts.contact', { contactId: 'c1' });

uiSref('contacts.contact', { contactId: 'c1' });

// @ts-expect-error a missing required param
void stateService.go('contacts.contact');

// @ts-expect-error a missing required param
uiSref('contacts.contact', {});

// @ts-expect-error a child inherits its parent's required param
void stateService.transitionTo('contacts.contact.edit', {});

// @ts-expect-error a missing required param
stateService.href('mymessages.messagelist.message', { folderId: 'inbox' });

// -- param types --------------------------------------------------------------

// @ts-expect-error a wrong param type: url placeholders are strings
void stateService.go('contacts.contact', { contactId: 1 });

// @ts-expect-error a wrong param type: the compose draft is a Partial<Message>
uiSref('mymessages.compose', { message: 'hi' });

// @ts-expect-error an undeclared param
void stateService.go('home', { contactId: 'c1' });

// -- defaults make a param optional to pass, present to read -------------------

void stateService.go('mymessages.messagelist');

uiSref('mymessages.compose', { message: { subject: 'Re: hi' } });

accepts<ParamsOf<'mymessages.messagelist'>>({});

accepts<ResolvedParamsOf<'mymessages.messagelist'>['folderId']>('inbox');

// @ts-expect-error a resolved default is present, so never undefined
accepts<ResolvedParamsOf<'mymessages.messagelist'>['folderId']>(undefined);

// -- loose targets stay loose ----------------------------------------------------

uiSref('.contact', { contactId: 'c1' });

uiSref('^', {}, { assignHref: 'auto' });

declare const fromState: StateDeclaration;

void stateService.go(fromState, { anything: 1 });

void stateService.go('home', { '#': 'top' });
