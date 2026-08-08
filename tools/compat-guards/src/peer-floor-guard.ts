#!/usr/bin/env node
// The installed lit-ui-router-floor alias must equal the floor of the
// catalog:publishedPeer lit-ui-router range, or the floor typecheck lies.
// Usage (from the package dir): peer-floor-guard
import { type Guard, guard } from './guard.ts';
import { rangeFloor } from './ranges.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit, and the floor fallback below relies on that narrowing
const g: Guard = guard('peer-floor-guard');

const range = await g.range('publishedPeer', 'lit-ui-router');

const floor =
  rangeFloor(range) ??
  g.fail(
    `semver cannot name a floor for range "${range}". Fix the publishedPeer ` +
      'lit-ui-router range in pnpm-workspace.yaml.',
  );

const installed = g.installed('lit-ui-router-floor', 'lit-ui-router');
if (installed !== floor) {
  g.fail(
    `lit-ui-router-floor resolves to ${installed}, but the floor of the ` +
      `declared peer range ${range} is ${floor}. Repin the peerFloor catalog ` +
      'in pnpm-workspace.yaml and reinstall.',
  );
}

g.pass(
  `lit-ui-router-floor -> lit-ui-router ${installed} matches range ${range} floor`,
);
