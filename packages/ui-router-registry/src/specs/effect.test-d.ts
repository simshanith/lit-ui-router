// `tsc --noEmit` is the assertion: ui-router-effect's route snapshot, typed by
// `ui-router-registry/effect`. The `Register` augmentation lives in
// registry.test-d.ts, in the same program.
import { Effect, SubscriptionRef } from 'effect';
import type { RawParams, StateDeclaration, UIRouter } from '@uirouter/core';
import { routeRef, snapshotRoute } from 'ui-router-effect';
import type { RouteTypes, TypedRouteSnapshot } from 'ui-router-effect';

import type { RegisteredRouteTypes, StateName } from '../index.js';
import type {} from '../effect.js';
import type { Draft } from './states.js';

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const routeTypes: RouteTypes;

// -- the augmentation ---------------------------------------------------------

accepts<RegisteredRouteTypes['snapshot']>(routeTypes.snapshot);

declare const typed: TypedRouteSnapshot;

accepts<RegisteredRouteTypes['snapshot']>(typed);

// -- routeRef ---------------------------------------------------------------------

const ref = routeRef(router);

accepts<SubscriptionRef.SubscriptionRef<RegisteredRouteTypes['snapshot']>>(ref);

const snapshot = Effect.runSync(SubscriptionRef.get(ref));

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

// -- snapshotRoute stays loose ------------------------------------------------

const loose = snapshotRoute(router);

accepts<RawParams>(loose.params);

accepts<StateDeclaration | undefined>(loose.current);
