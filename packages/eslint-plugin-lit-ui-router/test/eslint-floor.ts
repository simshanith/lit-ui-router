// node --import hook for test:peer-floor: every `eslint` import, from src or a
// dependency, resolves to the eslint-floor alias, as it would for a consumer
// installed at the floor of the eslint peer range.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const match = /^eslint(\/.*)?$/.exec(specifier);

    return nextResolve(
      match ? import.meta.resolve(`eslint-floor${match[1] ?? ''}`) : specifier,
      context,
    );
  },
});
