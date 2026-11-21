---
title: Staying on UI-Router
description: Use the framework-agnostic companion packages — the Navigation API location plugin, Signals and typed state names — in a @uirouter/react app, without Lit
type: guide
topic: migration
---

# Staying on UI-Router

An app that stays on [`@uirouter/react`](https://ui-router.github.io/react/docs/latest/), [`@uirouter/angular`](https://ui-router.github.io/ng2/docs/latest/) or `@uirouter/angularjs` does not need Lit to use the framework-agnostic packages in this family. Every package marked `agnostic` on the [Packages](/packages/) page peers on `@uirouter/core` 6 and its own runtime only, never on `lit` or `lit-ui-router`.

This guide covers the three packages verified against `@uirouter/react` 1.0.8 on React 19 with no `lit` installed:

- [`ui-router-navigation-location-plugin`](/packages/ui-router-navigation-location-plugin) — URL management through the browser Navigation API.
- [`ui-router-registry`](/packages/ui-router-registry) — types-only checked state names and params from `as const` state tables.
- [`ui-router-signals`](/packages/ui-router-signals) — TC39 Signals mirroring the settled route and in-flight transitions.

To switch the renderer to Lit as well, see [Coming from UI-Router](./coming-from-ui-router).

## Install

Each package takes `@uirouter/core` as a peer dependency. `@uirouter/react` 1.0.8 depends on `@uirouter/core` 6.1.2, so the packages share the copy already installed. `ui-router-signals` also peers on `signal-polyfill`, and `ui-router-registry` emits no JavaScript and belongs in `devDependencies`.

```bash
npm install ui-router-navigation-location-plugin ui-router-signals signal-polyfill
npm install --save-dev ui-router-registry
```

## Navigation API location plugin

[`ui-router-navigation-location-plugin`](/packages/ui-router-navigation-location-plugin) replaces `hashLocationPlugin` or `pushStateLocationPlugin` with the browser Navigation API while keeping clean URLs and `<base href>` handling. For browsers without `window.navigation`, see the [fallback pattern](/packages/ui-router-navigation-location-plugin#feature-detect-with-a-fallback).

When creating a `UIRouterReact` instance yourself and passing it to `<UIRouter router={router}>`, register `servicesPlugin` before the location plugin. Only `<UIRouter plugins={...}>` registers `servicesPlugin` automatically; without it, the location plugin has no router services to attach to.

```tsx
import { servicesPlugin } from '@uirouter/core';
import { UIRouter, UIRouterReact, UIView } from '@uirouter/react';
import { navigationLocationPlugin } from 'ui-router-navigation-location-plugin';

const router = new UIRouterReact();
// A router passed by instance needs servicesPlugin; <UIRouter plugins> adds it itself.
router.plugin(servicesPlugin);

router.plugin(navigationLocationPlugin);

states.forEach((state) => router.stateRegistry.register(state));

createRoot(document.getElementById('root')!).render(
  <UIRouter router={router}>
    <UIView />
  </UIRouter>,
);
```

## Typed state names

[`ui-router-registry`](/packages/ui-router-registry) infers valid state names and parameter shapes from the app's own `as const` state declarations through module augmentation. Misspelt state names, missing path parameters and wrong parameter types become TypeScript errors at compile time.

Core's `StateDeclaration` expects a mutable `resolve` array rather than the `readonly` tuple that `as const` produces, so declare `resolve` arrays in a typed variable outside the `as const` table.

```ts
import type { ResolveTypes, Transition } from '@uirouter/core';
import type { StatesOf } from 'ui-router-registry';

// Outside the `as const` table: core's StateDeclaration takes a mutable array.
const planetResolves: ResolveTypes[] = [
  {
    token: 'planet',
    deps: ['$transition$'],
    resolveFn: (transition: Transition) =>
      loadPlanet(transition.params<{ planetId: string }>().planetId),
  },
];

// Declared `as const` so ui-router-registry can read the names and params.
export const states = [
  { name: 'home', url: '/', component: Home },
  {
    name: 'planet',
    url: '/planets/:planetId',
    component: PlanetView,
    resolve: planetResolves,
  },
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof states> {}
}
```

`@uirouter/react`'s `useSref` and `<UISref>` accept a plain `string` for the state name and untyped params, so typed links need a small wrapper parameterized by `StateName` and `ParamsOf<Name>`. For programmatic navigation, annotate `useRouter().stateService` as `TypedStateService`; it is assignable from core's `StateService` without a cast.

```tsx
import type { ReactElement, ReactNode } from 'react';
import { useIsActive, useRouter, useSref } from '@uirouter/react';
import type {
  ParamsOf,
  StateName,
  TypedStateService,
} from 'ui-router-registry';

/** A link whose state name and params the registry checks. */
export function Link<Name extends StateName>(props: {
  to: Name;
  params: ParamsOf<Name>;
  children: ReactNode;
}): ReactElement {
  const sref = useSref(props.to, props.params);
  const active = useIsActive(props.to, props.params, true);

  return (
    <a {...sref} aria-current={active ? 'page' : undefined}>
      {props.children}
    </a>
  );
}

export function Home(): ReactElement {
  const stateService: TypedStateService = useRouter().stateService;

  return (
    <button
      type="button"
      onClick={() => void stateService.go('planet', { planetId: 'mars' })}
    >
      Go to Mars
    </button>
  );
}
```

## Signals

[`ui-router-signals`](/packages/ui-router-signals) exposes `RouterSignals.for(router)`, a read-only set of TC39 Signals tracking the settled `route` snapshot alongside in-flight `pending` transitions and transition `error`s.

Because `watchSelection` subscribes to a derived selection without framework bindings, a small hook bridges it into React state. A component outside `<UIView>` can then follow both the pending transition and the settled route. Importing `ui-router-registry/signals` carries the registered state types into `signals.route.get()`, so `route.includes('planet')` narrows `route.params.planetId` to `string`.

```tsx
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from '@uirouter/react';
// Carries the registry into ui-router-signals' route snapshot.
import type {} from 'ui-router-registry/signals';
import { RouterSignals, watchSelection } from 'ui-router-signals';

/** A value selected from the router's signals, re-rendered when it changes. */
function useRouterSignal<T>(select: (signals: RouterSignals) => T): T {
  const signals = RouterSignals.for(useRouter());
  const [value, setValue] = useState(() => select(signals));

  useEffect(
    () =>
      watchSelection(
        () => select(signals),
        undefined,
        (next) => setValue(() => next),
      ),
    [signals],
  );

  return value;
}

/** Outside every `<UIView>`: it follows the route through ui-router-signals. */
export function RouteStatus(): ReactElement {
  const status = useRouterSignal((signals) => {
    if (signals.pending.get()) return 'Loading…';

    const route = signals.route.get();

    // includes() narrows params to the planet state's own.
    return route.includes('planet')
      ? `Viewing ${route.params.planetId}`
      : 'Viewing the list';
  });

  return <p role="status">{status}</p>;
}
```

## MobX and Effect

Two other reactivity packages in the family share the same `agnostic` layer — they peer on `@uirouter/core` and their own runtime with no Lit dependency, and both have typed-snapshot entry points in `ui-router-registry`:

- [`ui-router-mobx`](/packages/ui-router-mobx) (`mobx` 6 or 7) — `RouterStore`, an observable mirror of the settled route, pending transition and error.
- [`ui-router-effect`](/packages/ui-router-effect) (`effect` 3 or 4) — `routeRef`, `pendingRef` and `errorRef` as Effect `SubscriptionRef`s.

Neither package is exercised against `@uirouter/react` yet, so no React integration code is shown here.

## Angular and AngularJS

`@uirouter/angular` and `@uirouter/angularjs` also peer on `@uirouter/core` 6, but neither has a verified example in this repository yet.

- **`@uirouter/angular`**: `ui-router-signals`, `ui-router-mobx`, `ui-router-effect` and `ui-router-registry` build on `@uirouter/core` without touching the view layer, though none have been exercised in an Angular build here. `ui-router-navigation-location-plugin` is an open question on Angular because `@uirouter/angular` takes its URL handling from Angular's `LocationStrategy`.
- **`@uirouter/angularjs`**: unproven with these packages; no example is planned.

## Coming next

Two more framework-agnostic packages are planned and remain unpublished: `ui-router-devtools` and `ui-router-otel`. Neither is available to install yet.

## The example

The example below runs `@uirouter/react` on React 19 with no `lit` in its install. Picking a planet navigates through the typed `Link` wrapper and `ui-router-navigation-location-plugin`; the status line outside `<UIView>` reads `ui-router-signals` to show `Loading…` while the planet resolve runs and then the settled route. The button on the home view calls `stateService.go` through `TypedStateService`.

<LiveExample name="uirouter-react" />
