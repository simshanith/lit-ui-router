// `tsc --noEmit` is the assertion: ui-router-mobx's RouterStore, typed by
// `ui-router-registry/mobx`. The `Register` augmentation lives in
// registry.test-d.ts, in the same program.
import type { StateDeclaration, UIRouter } from '@uirouter/core';
import { RouterStore } from 'ui-router-mobx';
import type {
  RouteTypes,
  TypedStoreName,
  TypedStoreState,
  TypedStoreTarget,
} from 'ui-router-mobx';

import type {
  RegisteredRouteTypes,
  StateName,
  UncheckedRef,
} from '../index.js';
import type {} from '../mobx.js';
import type { Draft } from './states.js';

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const routeTypes: RouteTypes;

// -- the augmentation ---------------------------------------------------------

accepts<RegisteredRouteTypes['snapshot']>(routeTypes.snapshot);

accepts<RegisteredRouteTypes['snapshots']>(routeTypes.snapshots);

accepts<TypedStoreName>('contacts.contact');

// @ts-expect-error a name the registry doesn't know
accepts<TypedStoreName>('contacts.contct');

// @ts-expect-error a future state's placeholder isn't a narrowing name
accepts<TypedStoreName>('admin.**');

accepts<TypedStoreTarget>('contacts.**');

// -- RouterStore ------------------------------------------------------------------

const store = RouterStore.for(router);

accepts<TypedStoreState['current']>(store.current);

accepts<StateName | undefined>(store.current?.name);

// @ts-expect-error params aren't readable until `includes` narrows the store
accepts<keyof typeof store.params>('draft');

if (store.includes('compose')) {
  accepts<Draft>(store.params.draft);
  accepts<'compose'>(store.current.name);
  // @ts-expect-error a wrong param type: the draft isn't a string
  accepts<string>(store.params.draft);
}

// Narrowing to an ancestor admits its descendants, `parent:` children included.
if (store.includes('messages')) {
  accepts<string>(store.params.sort);
  accepts<'messages' | 'messages.list' | 'messages.list.message' | 'compose'>(
    store.current.name,
  );
  // @ts-expect-error a descendant's param isn't guaranteed at the ancestor
  accepts<keyof typeof store.params>('folderId');
}

if (store.includes('messages.list.message')) {
  accepts<number>(store.params.messageId);
}

// Globs, objects and unchecked refs take the other overload.
accepts<boolean>(store.includes('contacts.**'));

declare const fromState: StateDeclaration;

accepts<boolean>(store.includes(fromState, { anything: 1 }));

declare const runtimeName: string;

// SAFETY: an opt-out on purpose; the name is one the registry can't see
accepts<boolean>(store.includes(runtimeName as UncheckedRef));

// @ts-expect-error a misspelled state name
store.includes('contacts.contct');

// @ts-expect-error a widened string isn't a registered name
store.includes(runtimeName);
