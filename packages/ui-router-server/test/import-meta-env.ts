// node --import hook for the test scripts: every src module reads one shared
// import.meta.env, DEV true as dist/development defines it, so specs run the
// development branch; stubDev() flips it the way vi.stubEnv does. A src
// module's #dev-gate resolves to its node source; dist/ keeps package.json#imports.
import { registerHooks } from 'node:module';

const KEY = Symbol.for('ui-router-server.test.import-meta-env');

const env = { DEV: true };

Object.defineProperty(globalThis, KEY, { value: env });

const src = new URL('../src/', import.meta.url).href;

const devGate = new URL('dev-gate.node.ts', src).href;

// Appended: a prefix shifts the offsets V8 coverage maps onto the file on disk.
const postlude = `import.meta.env = globalThis[Symbol.for(${JSON.stringify(KEY.description)})];`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '#dev-gate' && context.parentURL?.startsWith(src))
      return { url: devGate, shortCircuit: true };

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);

    if (!url.startsWith(src) || loaded.source === undefined) return loaded;

    // SAFETY: node's default load reads files as bytes; decode() throws on anything else
    const text = new TextDecoder().decode(loaded.source as Uint8Array);

    return { ...loaded, source: `${text}\n${postlude}` };
  },
});

/** Sets import.meta.env.DEV for every src module; returns the restore. */
export function stubDev(value: boolean): () => void {
  const previous = env.DEV;
  env.DEV = value;

  return () => {
    env.DEV = previous;
  };
}
