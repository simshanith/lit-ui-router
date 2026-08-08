#!/usr/bin/env node
// The installed lit-ui-router-floor alias must equal the floor of the
// catalog:publishedPeer lit-ui-router range, or the floor typecheck lies.
// Usage (from the package dir): peer-floor-guard
import { catalogRange, installedVersion } from './catalog.ts';

const range = await catalogRange(
  'peer-floor-guard',
  'publishedPeer',
  'lit-ui-router',
);

// caret floor = the literal version; widen deliberately if the range shape changes
const floorMatch = /^\^(\d+\.\d+\.\d+)$/.exec(range);
if (!floorMatch) {
  throw new Error(
    `peer-floor-guard: unsupported range shape "${range}"; teach me its floor`,
  );
}
const floor = floorMatch[1];

const installed = installedVersion('lit-ui-router-floor');
if (installed !== floor) {
  throw new Error(
    `peer-floor-guard: lit-ui-router-floor resolves to ${installed}, but the ` +
      `floor of the declared peer range ${range} is ${floor}. ` +
      'Repin the peerFloor catalog in pnpm-workspace.yaml and reinstall.',
  );
}

console.log(`peer-floor-guard: floor pin ${installed} matches range ${range}`);
