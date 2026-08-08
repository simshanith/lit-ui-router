#!/usr/bin/env node
// The mobx-6 alias must stay on a major the published mobx peer range still
// covers, or the mobx6-compat lanes test a support claim nobody ships.
// Usage (from the package dir): mobx6-compat-guard
import { guard } from './guard.ts';

const g = guard('mobx6-compat-guard');

const range = await g.range('publishedPeer', 'mobx');
if (!/(^|\|\| )\^6\./.test(range)) {
  g.fail(
    `publishedPeer mobx range "${range}" no longer covers major 6; drop the ` +
      'test:mobx6-compat/typecheck:mobx6 tasks or re-widen the range',
  );
}

const installed = g.installed('mobx-6', 'mobx');
if (!installed.startsWith('6.')) {
  g.fail(
    `mobx-6 resolves to ${installed}, not a 6.x build. Repin the mobx6-compat ` +
      'catalog in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(`mobx-6 -> mobx ${installed} within peer range ${range}`);
