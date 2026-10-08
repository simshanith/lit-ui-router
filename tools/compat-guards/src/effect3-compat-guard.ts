#!/usr/bin/env node
// The effect-3 alias must stay on a major the published effect peer range
// still covers, or the effect3-compat lanes test a support claim nobody ships.
// Usage (from the package dir): effect3-compat-guard
import { guard } from './guard.ts';

const g = guard('effect3-compat-guard');

const range = await g.range('publishedPeer', 'effect');
if (!/(^|\|\| )\^3\./.test(range)) {
  g.fail(
    `publishedPeer effect range "${range}" no longer covers major 3; drop the ` +
      'test:effect3-compat/typecheck:effect3 tasks or re-widen the range',
  );
}

const installed = g.installed('effect-3', 'effect');
if (!installed.startsWith('3.')) {
  g.fail(
    `effect-3 resolves to ${installed}, not a 3.x build. Repin the ` +
      'effect3-compat catalog in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(`effect-3 -> effect ${installed} within peer range ${range}`);
