// SAFETY: registry.ts, preloaded before the entry, installs it.
const { fixtureRegistry } = globalThis as { fixtureRegistry?: Set<string> };

if (!fixtureRegistry) throw new Error('registry.ts was not preloaded');

if (fixtureRegistry.has('fixture-element'))
  throw new Error('the name "fixture-element" has already been used');

fixtureRegistry.add('fixture-element');

export const tag = 'fixture-element';
