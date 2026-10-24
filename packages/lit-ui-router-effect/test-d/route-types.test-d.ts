// `tsc --noEmit` is the assertion: ui-router-effect's RouteTypes, filled in
// here, types routeRef's snapshot and the controller's selector through the
// published declarations. Nothing runs this file.
import { Effect, SubscriptionRef } from 'effect';
import type { ReactiveControllerHost } from 'lit';
import type {
  RawParams,
  StateDeclaration,
  Transition,
  UIRouter,
} from '@uirouter/core';
import { routeRef, snapshotRoute } from 'ui-router-effect';
import type { RouteSnapshot, TypedRouteSnapshot } from 'ui-router-effect';

import { RouterRefController } from '../src/index.js';
import type { TypedRouteSnapshot as LitTypedRouteSnapshot } from '../src/index.js';

interface ContactSnapshot {
  readonly current: StateDeclaration & { readonly name: 'contacts.contact' };
  readonly params: { readonly contactId: string };
  readonly transition: Transition | undefined;
  includes(stateOrName: string, params?: RawParams): boolean;
}

interface AppSnapshot {
  readonly current:
    | (StateDeclaration & { readonly name: 'home' | 'contacts.contact' })
    | undefined;
  readonly params: Readonly<Record<never, never>>;
  readonly transition: Transition | undefined;
  includes(state: 'contacts.contact'): this is ContactSnapshot;
  includes(glob: `${string}.**`, params?: RawParams): boolean;
}

declare module 'ui-router-effect' {
  interface RouteTypes {
    snapshot: AppSnapshot;
  }
}

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const host: ReactiveControllerHost & Element;

// -- routeRef -------------------------------------------------------------------

const ref = routeRef(router);

accepts<SubscriptionRef.SubscriptionRef<TypedRouteSnapshot>>(ref);

const snapshot = Effect.runSync(SubscriptionRef.get(ref));

accepts<AppSnapshot>(snapshot);

// @ts-expect-error params are empty until `includes` narrows the snapshot
accepts<{ readonly contactId: string }>(snapshot.params);

if (snapshot.includes('contacts.contact')) {
  accepts<string>(snapshot.params.contactId);

  accepts<'contacts.contact'>(snapshot.current.name);
}

// snapshotRoute stays the untyped constructor the ref is fed from.
accepts<RouteSnapshot>(snapshotRoute(router));

accepts<RawParams>(snapshotRoute(router).params);

declare const litSnapshot: LitTypedRouteSnapshot;

// The adapter derives the same type from routeRef.
accepts<AppSnapshot>(litSnapshot);

// -- RouterRefController --------------------------------------------------------

const contactId = new RouterRefController(host, (route) =>
  route.includes('contacts.contact') ? route.params.contactId : undefined,
);

accepts<string | undefined>(contactId.value);

new RouterRefController(host, (route) =>
  // @ts-expect-error the selector's snapshot is typed
  route.includes('contacts.contct'),
);
