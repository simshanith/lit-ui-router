// `tsc --noEmit` is the assertion: ui-router-mobx's RouteTypes, filled in
// here, types RouterStore's fields and `includes` and the controller's
// selector through the published declarations. Nothing runs this file.
import type { ReactiveControllerHost } from 'lit';
import type { RawParams, StateDeclaration, UIRouter } from '@uirouter/core';
import { RouterStore } from 'ui-router-mobx';
import type {
  TypedStoreName,
  TypedStoreNarrowing,
  TypedStoreState,
  TypedStoreTarget,
} from 'ui-router-mobx';

import { RouterReactionController } from '../src/index.js';

interface ContactSnapshot {
  readonly current: StateDeclaration & { readonly name: 'contacts.contact' };
  readonly params: { readonly contactId: string };
}

interface EditSnapshot {
  readonly current: StateDeclaration & {
    readonly name: 'contacts.contact.edit';
  };
  readonly params: { readonly contactId: string; readonly tab?: string };
}

interface AppSnapshot {
  readonly current:
    | (StateDeclaration & {
        readonly name: 'home' | 'contacts.contact' | 'contacts.contact.edit';
      })
    | undefined;
  readonly params: Readonly<Record<never, never>>;
  includes(
    stateOrName: `${string}.**` | StateDeclaration,
    params?: RawParams,
  ): boolean;
}

declare module 'ui-router-mobx' {
  interface RouteTypes {
    snapshot: AppSnapshot;
    snapshots: {
      home: never;
      'contacts.contact': ContactSnapshot | EditSnapshot;
      'contacts.contact.edit': EditSnapshot;
    };
  }
}

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const host: ReactiveControllerHost & Element;

// -- RouterStore ----------------------------------------------------------------

const store = RouterStore.for(router);

accepts<TypedStoreState['current']>(store.current);

accepts<'home' | 'contacts.contact' | 'contacts.contact.edit' | undefined>(
  store.current?.name,
);

// @ts-expect-error params are empty until `includes` narrows the store
accepts<{ readonly contactId: string }>(store.params);

accepts<TypedStoreName>('contacts.contact');

// @ts-expect-error a name the snapshots don't key
accepts<TypedStoreName>('contacts.contct');

if (store.includes('contacts.contact')) {
  accepts<string>(store.params.contactId);

  accepts<TypedStoreNarrowing<'contacts.contact'>>(store);

  // @ts-expect-error a state below contacts.contact may carry params the parent lacks
  accepts<{ readonly tab?: string }>(store.params);
}

if (store.includes('contacts.contact.edit')) {
  accepts<string | undefined>(store.params.tab);

  accepts<'contacts.contact.edit'>(store.current.name);
}

// Globs and objects take the other overload.
accepts<boolean>(store.includes('contacts.**'));

accepts<boolean>(store.includes({ name: 'home' }, { anything: 1 }));

// @ts-expect-error a misspelled name: the snapshot's `includes` types the other targets
store.includes('contacts.contct');

accepts<TypedStoreTarget>('admin.**');

// -- RouterReactionController ---------------------------------------------------

const contactId = new RouterReactionController(host, (routerStore) =>
  routerStore.includes('contacts.contact')
    ? routerStore.params.contactId
    : undefined,
);

accepts<string | undefined>(contactId.value);

// The untyped shapes, for reference.
declare const loose: { current?: StateDeclaration; params: RawParams };

accepts<RawParams>(loose.params);
