#!/usr/bin/env node
// The lit-2 alias must stay on a major the published lit peer range still
// covers, or the lit2-compat lanes test a support claim nobody ships.
// Usage (from the package dir): lit2-compat-guard
import { catalogRange, installedVersion } from './catalog.ts';

const range = await catalogRange('lit2-compat-guard', 'publishedPeer', 'lit');
if (!/(^|\|\| )\^2\./.test(range)) {
  throw new Error(
    `lit2-compat-guard: publishedPeer lit range "${range}" no longer covers ` +
      'major 2; drop the test:lit2-compat/typecheck:lit2 tasks or re-widen ' +
      'the range',
  );
}

const installed = installedVersion('lit-2');
if (!installed.startsWith('2.')) {
  throw new Error(
    `lit2-compat-guard: lit-2 resolves to ${installed}, not a 2.x build. ` +
      'Repin the lit2-compat catalog in pnpm-workspace.yaml and reinstall.',
  );
}

console.log(`lit2-compat-guard: lit-2 ${installed} within peer range ${range}`);
