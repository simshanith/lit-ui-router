// node --import hook for the test scripts: every src module reads one shared
// import.meta.env, DEV true and NODE false as dist/development defines them, so
// specs run the development branch; stubEnv() flips either key the way
// vi.stubEnv does.
import { registerHooks } from 'node:module';

const KEY = Symbol.for('ui-router-server.test.import-meta-env');

const env = { DEV: true, NODE: false };

Object.defineProperty(globalThis, KEY, { value: env });

const src = new URL('../src/', import.meta.url).href;

// One line, prepended without a newline, so coverage line numbers hold.
const prelude = `import.meta.env = globalThis[Symbol.for(${JSON.stringify(KEY.description)})];`;

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);

    if (!url.startsWith(src) || loaded.source === undefined) return loaded;

    // SAFETY: node's default load reads files as bytes; decode() throws on anything else
    const text = new TextDecoder().decode(loaded.source as Uint8Array);

    return { ...loaded, source: prelude + text };
  },
});

/** Sets an import.meta.env key for every src module; returns the restore. */
export function stubEnv(key: keyof typeof env, value: boolean): () => void {
  const previous = env[key];
  env[key] = value;

  return () => {
    env[key] = previous;
  };
}

/** Sets import.meta.env.DEV for every src module; returns the restore. */
export const stubDev = (value: boolean): (() => void) => stubEnv('DEV', value);
