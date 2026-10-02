#!/usr/bin/env node
// Each installed <peer>-floor alias must equal the floor of the <peer> range in
// the catalog the package's peer names, or the floor lane lies.
// Usage (from the package dir): peer-floor-guard
import semver from 'semver';

import { readManifest } from '@tools/bootstrap/manifest.ts';

import { type Guard, guard } from './guard.ts';
import { rangeFloor, upperLegs } from './ranges.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit, and the floor fallback below relies on that narrowing
const g: Guard = guard('peer-floor-guard');

const manifest = readManifest(process.cwd());
const catalogName = (spec: string | undefined) =>
  spec?.match(/^catalog:(\w+)$/)?.[1];

// a floor alias is a devDependency named <peer>-floor fed by a peerFloor* catalog
const peers = Object.entries(manifest?.devDependencies ?? {})
  .filter(
    ([alias, spec]) =>
      alias.endsWith('-floor') && catalogName(spec)?.startsWith('peerFloor'),
  )
  .map(([alias]) => alias.slice(0, -'-floor'.length));
if (peers.length === 0) {
  g.fail(
    `${process.cwd()} declares no <peer>-floor devDependency from a ` +
      'peerFloor* catalog.',
  );
}

for (const peer of peers) {
  const alias = `${peer}-floor`;
  const spec = manifest?.peerDependencies?.[peer];
  const catalog =
    catalogName(spec) ??
    g.fail(
      `${peer} peer "${spec ?? '<absent>'}" in ${process.cwd()} names no ` +
        'catalog; declare it as catalog:<name>.',
    );

  const range = await g.range(catalog, peer);

  // The alias proves only the lowest `||` leg. One upper leg is accepted when
  // the package's own <peer> devDependency, which every other lane runs on,
  // sits in it: API present at both the lowest floor and the dev version is
  // present at the upper leg's floor too, barring a removal later reverted.
  const upper = upperLegs(range);
  if (upper.length > 1) {
    g.fail(
      `${catalog} ${peer} range "${range}" has more than two \`||\` legs; ` +
        'the floor alias proves the lowest and the dev dependency one more. ' +
        'Narrow the range, or add a peerFloor alias per leg and teach this ' +
        'guard to check each.',
    );
  }
  let covered = '';
  const [leg] = upper;
  if (leg !== undefined) {
    const dev = g.installed(peer, peer);
    if (!semver.satisfies(dev, leg)) {
      g.fail(
        `${catalog} ${peer} range "${range}" has an upper leg "${leg}" that ` +
          `the ${peer} devDependency (${dev}) does not exercise. Move the ` +
          'devDependency into it, or narrow the range.',
      );
    }
    covered = `; dev ${peer} ${dev} runs its upper leg`;
  }

  const floor =
    rangeFloor(range) ??
    g.fail(
      `semver cannot name a floor for range "${range}". Fix the ${catalog} ` +
        `${peer} range in pnpm-workspace.yaml.`,
    );

  const installed = g.installed(alias, peer);
  if (installed !== floor) {
    g.fail(
      `${alias} resolves to ${installed}, but the floor of the declared peer ` +
        `range ${range} is ${floor}. Repin the alias's floor catalog in ` +
        'pnpm-workspace.yaml and reinstall.',
    );
  }

  g.pass(
    `${alias} -> ${peer} ${installed} matches range ${range} floor${covered}`,
  );
}
