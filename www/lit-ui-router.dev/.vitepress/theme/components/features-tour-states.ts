// The states the home page diagram draws, `top` naming the top-level state that fills the root view; test/features-tour-states.test.ts holds them to examples/features-tour/src/main.ts.
export const FEATURES_TOUR_STATES = [
  {
    name: 'routing',
    url: '/routing',
    path: '/routing',
    parent: '',
    top: 'routing',
  },
  {
    name: 'nested',
    url: '/nested',
    path: '/nested',
    parent: '',
    top: 'nested',
  },
  {
    name: 'nested.child',
    url: '/child',
    path: '/nested/child',
    parent: 'nested',
    top: 'nested',
  },
  {
    name: 'resolves',
    url: '/resolves',
    path: '/resolves',
    parent: '',
    top: 'resolves',
  },
] as const;

export type FeaturesTourStateName =
  (typeof FEATURES_TOUR_STATES)[number]['name'];

/** The state rules.initial names, shown until the embed reports another. */
export const FEATURES_TOUR_INITIAL: FeaturesTourStateName = 'routing';

/** The component of the `nested` state, which holds the nested `<ui-view>`. */
export const NESTED_VIEW_HOST = 'nested-page';

/** The resolve token the `resolves` state's component renders. */
export const RESOLVE_TOKEN = 'visit';

/** The example uses hashLocationPlugin, so a state's full URL is the frame's hash. */
export function stateForHash(hash: string): FeaturesTourStateName | undefined {
  return FEATURES_TOUR_STATES.find(({ path }) => hash === `#${path}`)?.name;
}
