import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useIsActive, useRouter, useSref } from '@uirouter/react';
import type {
  ParamsOf,
  StateName,
  TypedStateService,
} from 'ui-router-registry';
// Carries the registry into ui-router-signals' route snapshot.
import type {} from 'ui-router-registry/signals';
import { RouterSignals, watchSelection } from 'ui-router-signals';

import { PLANETS, type Planet } from './planets';

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

export function Home(): ReactElement {
  const stateService: TypedStateService = useRouter().stateService;

  return (
    <>
      <h2>Planets</h2>
      <p>
        <button
          type="button"
          onClick={() => {
            const { id } = PLANETS[Math.floor(Math.random() * PLANETS.length)];
            void stateService.go('planet', { planetId: id });
          }}
        >
          Pick one at random
        </button>
      </p>
    </>
  );
}

export function PlanetView(props: {
  planet: Planet | undefined;
}): ReactElement {
  if (!props.planet) return <h2>No such planet</h2>;

  return (
    <>
      <h2>{props.planet.name}</h2>
      <p>
        {props.planet.moons} {props.planet.moons === 1 ? 'moon' : 'moons'}
      </p>
    </>
  );
}
