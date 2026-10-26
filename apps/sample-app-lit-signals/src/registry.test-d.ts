// Type-level spec for the app's registry wiring: `tsc --noEmit` is the assertion.
import type { ReactiveControllerHost } from 'lit';
import { RouterSignalController } from 'lit-ui-router-signals';
import type { Message } from 'sample-app-shared/app/mymessages/interface.js';
import type { TypedRouteSnapshot, TypedStateService } from 'ui-router-registry';
import { uiSref } from 'lit-ui-router';

declare const stateService: TypedStateService;

declare const host: ReactiveControllerHost & Element;

declare const snapshot: TypedRouteSnapshot;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// -- the cases that must fail, through the Lit surfaces ---------------------------

// @ts-expect-error a misspelled state name
uiSref('contact');

// @ts-expect-error a missing required param
uiSref('mymessages.messagelist.message', { folderId: 'inbox' });

// @ts-expect-error a wrong param type
void stateService.go('contacts.contact.edit', { contactId: ['c1'] });

// -- and through the signals snapshot ----------------------------------------------

// @ts-expect-error a misspelled state name
snapshot.includes('mymessages.compse');

// @ts-expect-error params aren't readable until the snapshot is narrowed
accepts<keyof typeof snapshot.params>('message');

if (snapshot.includes('mymessages.compose')) {
  accepts<Partial<Message>>(snapshot.params.message);
  accepts<'mymessages.compose'>(snapshot.current.name);
  // @ts-expect-error a wrong param type: the draft isn't a string
  accepts<string>(snapshot.params.message);
}

// Narrowing to an ancestor admits its descendants and their params.
if (snapshot.includes('mymessages.messagelist')) {
  accepts<string>(snapshot.params.folderId);
  accepts<'mymessages.messagelist' | 'mymessages.messagelist.message'>(
    snapshot.current.name,
  );
  // @ts-expect-error a descendant's param isn't guaranteed at the ancestor
  accepts<keyof typeof snapshot.params>('messageId');
}

// Globs still answer, without narrowing.
accepts<boolean>(snapshot.includes('contacts.**'));

// -- and through lit-ui-router-signals' controller, typed by the subpath ----------

const messageParam = new RouterSignalController(host, (route) => {
  const current = route.route.get();

  accepts<TypedRouteSnapshot>(current);

  return current.includes('mymessages.compose')
    ? current.params.message
    : undefined;
});

accepts<Partial<Message> | undefined>(messageParam.value);

new RouterSignalController(host, (route) =>
  // @ts-expect-error a misspelled state name
  route.route.get().includes('mymessages.compse'),
);
