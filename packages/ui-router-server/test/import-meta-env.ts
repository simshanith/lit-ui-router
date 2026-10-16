// node --import hook for the test scripts: every src module reads one shared
// import.meta.env, DEV true as vite serves it in development, so specs run the
// development branch and stubDev() flips it the way vi.stubEnv('DEV') does.
import { registerHooks } from 'node:module';

const KEY = Symbol.for('ui-router-server.test.import-meta-env');

const env = { DEV: true };

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

/** Sets import.meta.env.DEV for every src module; returns the restore. */
export function stubDev(value: boolean): () => void {
  const previous = env.DEV;
  env.DEV = value;

  return () => {
    env.DEV = previous;
  };
}
