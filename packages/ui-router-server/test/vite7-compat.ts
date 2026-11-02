// node --import hook for test:vite7-compat: every `vite` import, the plugin's
// lazy one included, resolves to the vite-7 alias.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier !== 'vite' && !specifier.startsWith('vite/'))
      return nextResolve(specifier, context);

    return nextResolve(`vite-7${specifier.slice('vite'.length)}`, {
      ...context,
      parentURL: import.meta.url,
    });
  },
});

const { version } = await import('vite');

if (!version.startsWith('7.'))
  throw new Error(`vite7-compat: vite resolved to ${version}, not a 7.x build`);
