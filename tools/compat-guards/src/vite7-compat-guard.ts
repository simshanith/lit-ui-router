#!/usr/bin/env node
// The vite-7 alias must stay on a major the published vite peer range
// covers, or the vite7-compat lanes test a support claim nobody ships.
// Usage (from the package dir): vite7-compat-guard
import { guard } from './guard.ts';

const g = guard('vite7-compat-guard');

const range = await g.range('publishedPeer', 'vite');

if (!/(^|\|\| )\^7\./.test(range)) {
  g.fail(
    `publishedPeer vite range "${range}" no longer covers major 7; drop the ` +
      'test:vite7-compat/typecheck:vite7 tasks or re-widen the range',
  );
}

const installed = g.installed('vite-7', 'vite');

if (!installed.startsWith('7.')) {
  g.fail(
    `vite-7 resolves to ${installed}, not a 7.x build. Repin the vite7-compat ` +
      'catalog in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(`vite-7 -> vite ${installed} within peer range ${range}`);
