// `tsc --noEmit` is the assertion, so this file rides typecheck:tsc. Nothing
// imports it, and its `declare`d values would throw if it ever ran.
import type { StateDeclaration } from '@uirouter/core';

import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  TypedRouteSnapshot,
  TypedStateService,
} from '../index.js';
import type { AboutState, Draft, dynamicState, states } from './states.js';

declare module '../index.js' {
  interface Register {
    states: (typeof states)[number] | typeof AboutState | typeof dynamicState;
  }
}

declare const stateService: TypedStateService;

declare const snapshot: TypedRouteSnapshot;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// -- names --------------------------------------------------------------------

accepts<StateName>('contacts.contact.edit');

accepts<StateName>('compose');

accepts<StateName>('about');

// @ts-expect-error a misspelled state name
accepts<StateName>('contcts');

// @ts-expect-error a future state's placeholder isn't a target
accepts<StateName>('admin.**');

// @ts-expect-error a widened name doesn't widen StateName to string
accepts<StateName>('dynamic');

void stateService.go('home');

// @ts-expect-error a misspelled state name
void stateService.go('hom');

// @ts-expect-error a misspelled state name
stateService.href('contacts.x');

// -- required params: url placeholders without a default ----------------------

void stateService.go('contacts.contact', { contactId: 'c1' });

// @ts-expect-error a missing required param
void stateService.go('contacts.contact');

// @ts-expect-error a child inherits its parent's required param
void stateService.transitionTo('contacts.contact.edit', {});

void stateService.go('messages.list.message', { messageId: 1 });

// @ts-expect-error a missing required param
stateService.href('messages.list.message', { folderId: 'inbox' });

// -- param types --------------------------------------------------------------

// @ts-expect-error a wrong param type: a path placeholder is a string
void stateService.go('contacts.contact', { contactId: 1 });

// @ts-expect-error a wrong param type: `{messageId:int}` is a number
void stateService.go('messages.list.message', { messageId: '1' });

// @ts-expect-error a wrong param type: the draft's default is an object
void stateService.go('compose', { draft: 'hi' });

void stateService.go('compose', { draft: { subject: 'Re: hi' }, meta: [1] });

// @ts-expect-error an undeclared param
void stateService.go('home', { contactId: 'c1' });

// -- defaults and query params: optional to pass ------------------------------

void stateService.go('messages.list');

void stateService.go('search');

accepts<ParamsOf<'messages.list'>>({});

accepts<ParamsOf<'search'>>({ q: 'lit', page: 2 });

// @ts-expect-error a wrong param type: `{page:int}` is a number
accepts<ParamsOf<'search'>>({ page: '2' });

// -- reading back: defaults present, bare query params optional ---------------

accepts<ResolvedParamsOf<'messages.list'>['folderId']>('inbox');

// @ts-expect-error a resolved default is present, so never undefined
accepts<ResolvedParamsOf<'messages.list'>['folderId']>(undefined);

accepts<ResolvedParamsOf<'search'>['q']>(undefined);

// `parent:` inherits the parent's params, as a dotted name does.
accepts<ResolvedParamsOf<'compose'>['sort']>('date');

// -- loose targets stay loose -------------------------------------------------

void stateService.go('.contact', { contactId: 'c1' });

void stateService.go('^');

declare const fromState: StateDeclaration;

void stateService.go(fromState, { anything: 1 });

void stateService.go('home', { '#': 'top' });

accepts<boolean>(stateService.includes('contacts.**'));

// -- the snapshot -------------------------------------------------------------

// @ts-expect-error a misspelled state name
snapshot.includes('mesages');

// @ts-expect-error params aren't readable until the snapshot is narrowed
accepts<keyof typeof snapshot.params>('draft');

if (snapshot.includes('compose')) {
  accepts<Draft>(snapshot.params.draft);
  accepts<'compose'>(snapshot.current.name);
  // @ts-expect-error a wrong param type: the draft isn't a string
  accepts<string>(snapshot.params.draft);
}

// Narrowing to an ancestor admits its descendants, `parent:` children included.
if (snapshot.includes('messages')) {
  accepts<string>(snapshot.params.sort);
  accepts<'messages' | 'messages.list' | 'messages.list.message' | 'compose'>(
    snapshot.current.name,
  );
  // @ts-expect-error a descendant's param isn't guaranteed at the ancestor
  accepts<keyof typeof snapshot.params>('folderId');
}

// Globs still answer, without narrowing.
accepts<boolean>(snapshot.includes('contacts.**'));
