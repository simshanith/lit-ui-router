// Type-level spec for the app's registry wiring: `tsc --noEmit` is the assertion.
import type { ReactiveControllerHost } from 'lit';
import { RouterReactionController } from 'lit-ui-router-mobx';
import type { RouterStore } from 'lit-ui-router-mobx';
import type { Message } from 'sample-app-shared/app/mymessages/interface.js';
import type { StateName, TypedStateService } from 'ui-router-registry';

declare const stateService: TypedStateService;

declare const host: ReactiveControllerHost & Element;

declare const store: RouterStore;

/** Assignability probe: the call typechecks iff the argument satisfies T. */
declare function accepts<T>(value: T): T;

// @ts-expect-error a wrong param type
void stateService.go('contacts.contact.edit', { contactId: ['c1'] });

// -- the store, typed by ui-router-registry/mobx -----------------------------------

accepts<StateName | undefined>(store.current?.name);

// @ts-expect-error a misspelled state name
store.includes('mymessages.compse');

// @ts-expect-error params aren't readable until `includes` narrows the store
accepts<keyof typeof store.params>('message');

if (store.includes('mymessages.compose')) {
  accepts<Partial<Message>>(store.params.message);
  accepts<'mymessages.compose'>(store.current.name);
  // @ts-expect-error a wrong param type: the draft isn't a string
  accepts<string>(store.params.message);
}

// Narrowing to an ancestor admits its descendants and their params.
if (store.includes('mymessages.messagelist')) {
  accepts<string>(store.params.folderId);
  accepts<'mymessages.messagelist' | 'mymessages.messagelist.message'>(
    store.current.name,
  );
  // @ts-expect-error a descendant's param isn't guaranteed at the ancestor
  accepts<keyof typeof store.params>('messageId');
}

// Globs still answer, without narrowing.
accepts<boolean>(store.includes('contacts.**'));

// -- and through lit-ui-router-mobx's controller ------------------------------------

const messageParam = new RouterReactionController(host, (route) =>
  route.includes('mymessages.compose') ? route.params.message : undefined,
);

accepts<Partial<Message> | undefined>(messageParam.value);

new RouterReactionController(host, (route) =>
  // @ts-expect-error a misspelled state name
  route.includes('mymessages.compse'),
);
