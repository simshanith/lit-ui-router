// The states the home page diagram draws, `more` where a component renders past the markup shown; test/helloworld-states.test.ts holds them to examples/helloworld/src/main.ts.
export const HELLO_WORLD_STATES = [
  {
    name: 'hello',
    url: '/hello',
    renders: '<h3>Hello World!</h3>',
    more: false,
  },
  { name: 'about', url: '/about', renders: '<h3>About</h3>', more: true },
] as const;

export type HelloWorldStateName = (typeof HELLO_WORLD_STATES)[number]['name'];

/** The state rules.initial names, shown until the embed reports another. */
export const HELLO_WORLD_INITIAL: HelloWorldStateName = 'hello';

/** The example uses hashLocationPlugin, so a state's URL is the frame's hash. */
export function stateForHash(hash: string): HelloWorldStateName | undefined {
  return HELLO_WORLD_STATES.find(({ url }) => hash === `#${url}`)?.name;
}
