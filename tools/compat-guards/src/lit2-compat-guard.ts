#!/usr/bin/env node
// The lit-2 alias must stay on a major the published lit peer range still
// covers, or the lit2-compat lanes test a support claim nobody ships.
// Usage (from the package dir): lit2-compat-guard
import { guard } from './guard.ts';
import { coversMajor2 } from './ranges.ts';

const g = guard('lit2-compat-guard');

const range = await g.range('publishedPeer', 'lit');
if (!coversMajor2(range)) {
  g.fail(
    `publishedPeer lit range "${range}" no longer covers major 2; drop the ` +
      'test:lit2-compat/typecheck:lit2 tasks or re-widen the range',
  );
}

const installed = g.installed('lit-2', 'lit');
if (!installed.startsWith('2.')) {
  g.fail(
    `lit-2 resolves to ${installed}, not a 2.x build. Repin the lit2-compat ` +
      'catalog in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(`lit-2 -> lit ${installed} within peer range ${range}`);
