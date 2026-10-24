// `tsc --noEmit` is the assertion: ui-router-signals' RouteTypes, filled in
// here, types RouterSignals' `route` and the controller's selector through
// the published declarations. Nothing runs this file.
import type { ReactiveControllerHost } from 'lit';
import type {
  RawParams,
  StateDeclaration,
  Transition,
  UIRouter,
} from '@uirouter/core';
import { RouterSignals, watchSelection } from 'ui-router-signals';
import type { RouteSnapshot, TypedRouteSnapshot } from 'ui-router-signals';

import { RouterSignalController } from '../src/index.js';

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

declare module 'ui-router-signals' {
  interface RouteTypes {
    snapshot: AppSnapshot;
  }
}

declare function accepts<T>(value: T): T;

declare const router: UIRouter;

declare const host: ReactiveControllerHost & Element;

// -- RouterSignals --------------------------------------------------------------

const signals = RouterSignals.for(router);

accepts<TypedRouteSnapshot>(signals.route.get());

accepts<AppSnapshot>(signals.route.get());

const snapshot = signals.route.get();

// @ts-expect-error params are empty until `includes` narrows the snapshot
accepts<{ readonly contactId: string }>(snapshot.params);

if (snapshot.includes('contacts.contact')) {
  accepts<string>(snapshot.params.contactId);

  accepts<'contacts.contact'>(snapshot.current.name);
}

watchSelection(
  () => signals.route.get(),
  undefined,
  (route) => accepts<AppSnapshot>(route),
);

// The other fields keep their untyped shapes.
accepts<RawParams>(signals.params.get());

accepts<StateDeclaration | undefined>(signals.current.get());

declare const untyped: RouteSnapshot;

accepts<RawParams>(untyped.params);

// -- RouterSignalController -----------------------------------------------------

const contactId = new RouterSignalController(host, (route) => {
  const current = route.route.get();

  return current.includes('contacts.contact')
    ? current.params.contactId
    : undefined;
});

accepts<string | undefined>(contactId.value);

new RouterSignalController(host, (route) =>
  // @ts-expect-error the selector's snapshot is typed
  route.route.get().includes('contacts.contct'),
);
