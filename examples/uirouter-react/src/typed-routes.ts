// Type-only checks that the registry types this React app's state names and
// params; `npm run typecheck` fails if any expected error goes away. Nothing imports it.
import type {
  ParamsOf,
  StateName,
  TypedStateService,
} from 'ui-router-registry';
import { RouterSignals } from 'ui-router-signals';

declare const stateService: TypedStateService;

export const names: StateName[] = ['home', 'planet'];

// @ts-expect-error: no state is registered under this name
export const misspelt: StateName = 'planets';

export const params: ParamsOf<'planet'> = { planetId: 'mars' };

// @ts-expect-error: the url placeholder is required
export const missing: ParamsOf<'planet'> = {};

export function checks(router: Parameters<typeof RouterSignals.for>[0]) {
  void stateService.go('planet', { planetId: 'mars' });
  // @ts-expect-error: planetId is a string, not a number
  void stateService.go('planet', { planetId: 4 });

  const route = RouterSignals.for(router).route.get();

  // includes() narrows params to the planet state's
  if (route.includes('planet')) {
    const planetId: string = route.params.planetId;

    return planetId;
  }

  return undefined;
}
