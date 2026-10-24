// `tsc --noEmit` is the assertion, so this file rides typecheck:tsc. Nothing
// imports it, and its `declare`d values would throw if it ever ran.
import type { StateDeclaration } from '@uirouter/core';

import type {
  ParamsOf,
  ResolvedParamsOf,
  StateName,
  RelativeRef,
  TypedRouteSnapshot,
  TypedStateService,
  UncheckedRef,
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

// a `value: null` default clears a url param, and an untyped non-url one is core's `any`
void stateService.go('search', { kv: null, tab: { any: 'value' } });

// @ts-expect-error a query param with a null default still takes a string
accepts<ParamsOf<'search'>>({ kv: 1 });

// -- reading back: defaults present, bare query params optional ---------------

accepts<ResolvedParamsOf<'messages.list'>['folderId']>('inbox');

// @ts-expect-error a resolved default is present, so never undefined
accepts<ResolvedParamsOf<'messages.list'>['folderId']>(undefined);

accepts<ResolvedParamsOf<'search'>['q']>(undefined);

accepts<ResolvedParamsOf<'search'>['kv']>(null);

// @ts-expect-error a null default is present, so never undefined
accepts<ResolvedParamsOf<'search'>['kv']>(undefined);

declare const tab: ResolvedParamsOf<'search'>['tab'];

// @ts-expect-error an untyped non-url param reads as core's `any`, not its default's type
accepts<string | null>(tab);

// `parent:` inherits the parent's params, as a dotted name does.
accepts<ResolvedParamsOf<'compose'>['sort']>('date');

// -- relative refs: the tail is checked, params stay loose ---------------------

void stateService.go('.contact', { contactId: 'c1' });

void stateService.go('^');

void stateService.go('^.edit');

void stateService.go('^.^.contact.edit', { anything: 1 });

accepts<RelativeRef>('.home');

// @ts-expect-error a relative tail that ends no registered name
void stateService.go('.contcat');

// @ts-expect-error a relative tail that ends no registered name
stateService.href('^.edti');

// @ts-expect-error a relative ref needs a tail or an ancestor step
accepts<RelativeRef>('.');

// -- widened and unchecked targets --------------------------------------------

declare const runtimeName: string;

// SAFETY: an opt-out on purpose; the name is one the registry can't see
const uncheckedName = runtimeName as UncheckedRef;

// @ts-expect-error a widened string isn't a registered name
void stateService.go(runtimeName);

// @ts-expect-error a widened string isn't a registered name
stateService.href(runtimeName);

void stateService.go(uncheckedName, { anything: 1 });

stateService.href(uncheckedName);

void stateService.transitionTo(uncheckedName, {}, { reload: true });

void stateService.target(uncheckedName, { anything: 1 });

accepts<boolean>(stateService.is(uncheckedName, { anything: 1 }));

accepts<boolean>(stateService.includes(uncheckedName, { anything: 1 }));

accepts<boolean>(snapshot.includes(uncheckedName));

// @ts-expect-error a plain string isn't an UncheckedRef without the cast
accepts<UncheckedRef>(runtimeName);

// -- object targets stay loose --------------------------------------------------

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
