---
title: Staying on UI-Router
description: Use the framework-agnostic companion packages — the Navigation API location plugin, Signals and typed state names — in a @uirouter/react app, without Lit
type: guide
topic: migration
---

# Staying on UI-Router

<!-- copy: pending -->

## Install

<!-- copy: pending -->

```bash
npm install ui-router-navigation-location-plugin ui-router-signals signal-polyfill
npm install --save-dev ui-router-registry
```

## Navigation API location plugin

<!-- copy: pending -->

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

<!-- copy: pending -->

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

<!-- copy: pending -->

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

<!-- copy: pending -->

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

<!-- copy: pending -->

## Angular and AngularJS

<!-- copy: pending -->

## Coming next

<!-- copy: pending -->

## The example

<!-- copy: pending -->

<LiveExample name="uirouter-react" />
