// `tsc --noEmit` is the assertion: ui-router-signals' route snapshot, typed by
// `ui-router-registry/signals`. The `Register` augmentation lives in
// registry.test-d.ts, in the same program.
import type { RawParams, StateDeclaration, UIRouter } from '@uirouter/core';
import { RouterSignals, watchSelection } from 'ui-router-signals';
import type { RouteTypes, TypedRouteSnapshot } from 'ui-router-signals';

import type { RegisteredRouteTypes, StateName } from '../index.js';
import type {} from '../signals.js';
import type { Draft } from './states.js';

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const routeTypes: RouteTypes;

// -- the augmentation ---------------------------------------------------------

accepts<RegisteredRouteTypes['snapshot']>(routeTypes.snapshot);

declare const typed: TypedRouteSnapshot;

accepts<RegisteredRouteTypes['snapshot']>(typed);

// -- RouterSignals.route --------------------------------------------------------

const snapshot = RouterSignals.for(router).route.get();

accepts<StateName | undefined>(snapshot.current?.name);

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

if (snapshot.includes('messages.list')) {
  accepts<string>(snapshot.params.folderId);
  accepts<'messages.list' | 'messages.list.message'>(snapshot.current.name);
}

// Globs still answer, without narrowing.
accepts<boolean>(snapshot.includes('contacts.**'));

watchSelection(
  () => RouterSignals.for(router).route.get(),
  undefined,
  (route) => {
    if (route.includes('contacts.contact'))
      accepts<string>(route.params.contactId);
  },
);

// -- the per-field signals stay loose ------------------------------------------

accepts<RawParams>(RouterSignals.for(router).params.get());

accepts<StateDeclaration | undefined>(RouterSignals.for(router).current.get());
