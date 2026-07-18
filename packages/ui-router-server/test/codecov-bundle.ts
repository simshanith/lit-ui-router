// Measurement build for codecov bundle stats: rolldown (the vite-8-era
// consumer bundler) emits each public entry, then the shared uploader ships
// one bundle series per entry. Skips cleanly when CODECOV_TOKEN is unset.
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { bundleEntry } from './bundle.ts';

// Peers are the consumer's own installs; the series prices this package's code.
const PEERS = ['@uirouter/core', 'hono'];

const ENTRIES: Record<string, string> = {
  matcher: 'url-matcher.ts',
  index: 'index.ts',
  redirects: 'redirects.ts',
  simulate: 'simulate.ts',
  connect: 'connect.ts',
  fetch: 'fetch.ts',
  hono: 'hono.ts',
  vite: 'vite.ts',
};

const statsRoot = fileURLToPath(new URL('../dist-stats', import.meta.url));
await rm(statsRoot, { recursive: true, force: true });

for (const [tier, file] of Object.entries(ENTRIES)) {
  const { chunks } = await bundleEntry(file, 'rolldown', {
    minify: true,
    external: PEERS,
  });
  const dir = `${statsRoot}/${tier}`;
  await mkdir(dir, { recursive: true });
  for (const chunk of chunks)
    await writeFile(`${dir}/${chunk.name}`, chunk.code);
  // The bin resolves from the @tools/build_and_test devDep on the script PATH.
  execFileSync(
    'upload-bundle-stats',
    [`ui-router-server-${tier}-esm`, dir, '--no-manifest'],
    { stdio: 'inherit' },
  );
}
