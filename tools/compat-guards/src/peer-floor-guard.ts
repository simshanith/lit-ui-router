#!/usr/bin/env node
// The installed lit-ui-router-floor alias must equal the floor of the
// lit-ui-router range in the catalog the package's peer names, or the floor
// typecheck lies.
// Usage (from the package dir): peer-floor-guard
import { readManifest } from '@tools/bootstrap/manifest.ts';

import { type Guard, guard } from './guard.ts';
import { rangeFloor, rangeLegs } from './ranges.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit, and the floor fallback below relies on that narrowing
const g: Guard = guard('peer-floor-guard');

const peer = readManifest(process.cwd())?.peerDependencies?.['lit-ui-router'];
const catalog =
  peer?.match(/^catalog:(\w+)$/)?.[1] ??
  g.fail(
    `lit-ui-router peer "${peer ?? '<absent>'}" in ${process.cwd()} names no ` +
      'catalog; declare it as catalog:<name>.',
  );

const range = await g.range(catalog, 'lit-ui-router');

// This lane proves the floor by typechecking against ONE installed version, so
// a multi-leg range would pass having proved only its lowest leg — the upper
// legs would be declared support nothing ever checked. publishedPeer.lit is
// already `^2.0.0 || ^3.0.0`, so the shape is one range widening away.
if (rangeLegs(range) > 1) {
  g.fail(
    `${catalog} lit-ui-router range "${range}" has more than one \`||\` ` +
      'leg, and this lane can only prove the lowest one. Narrow the range, or ' +
      'add a peerFloor alias per leg and teach this guard to check each.',
  );
}

const floor =
  rangeFloor(range) ??
  g.fail(
    `semver cannot name a floor for range "${range}". Fix the ${catalog} ` +
      'lit-ui-router range in pnpm-workspace.yaml.',
  );

const installed = g.installed('lit-ui-router-floor', 'lit-ui-router');
if (installed !== floor) {
  g.fail(
    `lit-ui-router-floor resolves to ${installed}, but the floor of the ` +
      `declared peer range ${range} is ${floor}. Repin the alias's floor ` +
      'catalog in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(
  `lit-ui-router-floor -> lit-ui-router ${installed} matches range ${range} floor`,
);
