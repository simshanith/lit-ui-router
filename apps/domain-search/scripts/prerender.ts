// Draws the one static shell for /domain-search, with no query, into the built index.html.
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The shim replaces the registry when it finishes installing, so everything that defines an element loads after it.
await import('lit-ui-router-ssr/register');

const { UIRouterLit } = await import('lit-ui-router/pure');

const { prerender, settle } = await import('lit-ui-router-ssr');

const { installServerLocation } = await import('ui-router-server/location');

const { PRE_PAINT_SLOT, prePaintScript } = await import('../src/pre-paint.ts');

const { MOUNT, mounts } = await import('../src/routes.ts');

const { registerStates } = await import('../src/states.ts');

const { page } = await import('../src/views.ts');

const ROOT = '<div id="root"></div>';

const outDir = fileURLToPath(new URL('../dist', import.meta.url));

const shell = await readFile(`${outDir}/index.html`, 'utf8');

const main = async (): Promise<void> => {
  if (!shell.includes(ROOT)) {
    console.error(`dist/index.html has no ${ROOT} to draw into`);
    process.exitCode = 1;

    return;
  }

  const router = installServerLocation(new UIRouterLit(), {
    urlConfig: { strict: false },
  });

  registerStates(router);

  const result = await prerender({
    mounts,
    router,
    outDir,
    paths: [MOUNT],
    notFound: false,
    rules: 'none',
    renderShell: async (_verdict, { path }) => {
      await settle(router, path);

      return page(router);
    },
    document: (body) => {
      if (!body.includes(PRE_PAINT_SLOT)) {
        throw new Error(`the drawn page has no ${PRE_PAINT_SLOT}`);
      }

      return shell.replace(
        ROOT,
        `<div id="root">${body.replace(PRE_PAINT_SLOT, prePaintScript())}</div>`,
      );
    },
  });

  console.log('prerender:', result.tally);
};

await main();
