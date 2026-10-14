#!/usr/bin/env node
// Each installed <dep>-floor alias must equal the floor of the <dep> range in
// the catalog the package's peer or dependency names, or the floor lane lies.
// Usage (from the package dir): floor-guard
import semver from 'semver';

import { readManifest } from '@tools/bootstrap/manifest.ts';

import { type Guard, guard } from './guard.ts';
import { rangeFloor, upperLegs } from './ranges.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit, and the floor fallback below relies on that narrowing
const g: Guard = guard('floor-guard');

const manifest = readManifest(process.cwd());

const catalogName = (spec: string | undefined) =>
  spec?.match(/^catalog:(\w+)$/)?.[1];

const floorName = (alias: string) => alias.slice(0, -'-floor'.length);

// a floor alias is a devDependency named <name>-floor: fed by a peerFloor*
// catalog for a peer, or by any catalog for a published dependency
const deps = Object.entries(manifest?.devDependencies ?? {})
  .filter(
    ([alias, spec]) =>
      alias.endsWith('-floor') &&
      (catalogName(spec)?.startsWith('peerFloor') === true ||
        floorName(alias) in (manifest?.dependencies ?? {})),
  )
  .map(([alias]) => floorName(alias));

if (deps.length === 0) {
  g.fail(
    `${process.cwd()} declares no <dep>-floor devDependency for a peer from a ` +
      'peerFloor* catalog, or for a dependency.',
  );
}

for (const dep of deps) {
  const alias = `${dep}-floor`;

  const kind =
    manifest?.peerDependencies?.[dep] === undefined ? 'dependency' : 'peer';

  const spec =
    manifest?.peerDependencies?.[dep] ?? manifest?.dependencies?.[dep];

  const catalog =
    catalogName(spec) ??
    g.fail(
      `${dep} ${kind} "${spec ?? '<absent>'}" in ${process.cwd()} names no ` +
        'catalog; declare it as catalog:<name>.',
    );

  const range = await g.range(catalog, dep);

  // The alias proves only the lowest `||` leg. One upper leg is accepted when
  // the package's own <dep> devDependency, which every other lane runs on,
  // sits in it: API present at both the lowest floor and the dev version is
  // present at the upper leg's floor too, barring a removal later reverted.
  const upper = upperLegs(range);

  if (upper.length > 1) {
    g.fail(
      `${catalog} ${dep} range "${range}" has more than two \`||\` legs; ` +
        'the floor alias proves the lowest and the dev dependency one more. ' +
        'Narrow the range, or add a peerFloor alias per leg and teach this ' +
        'guard to check each.',
    );
  }

  let covered = '';
  const [leg] = upper;

  if (leg !== undefined) {
    const dev = g.installed(dep, dep);

    if (!semver.satisfies(dev, leg)) {
      g.fail(
        `${catalog} ${dep} range "${range}" has an upper leg "${leg}" that ` +
          `the ${dep} devDependency (${dev}) does not exercise. Move the ` +
          'devDependency into it, or narrow the range.',
      );
    }

    covered = `; dev ${dep} ${dev} runs its upper leg`;
  }

  const floor =
    rangeFloor(range) ??
    g.fail(
      `semver cannot name a floor for range "${range}". Fix the ${catalog} ` +
        `${dep} range in pnpm-workspace.yaml.`,
    );

  const installed = g.installed(alias, dep);

  if (installed !== floor) {
    g.fail(
      `${alias} resolves to ${installed}, but the floor of the declared ${kind} ` +
        `range ${range} is ${floor}. Repin the alias's floor catalog in ` +
        'pnpm-workspace.yaml and reinstall.',
    );
  }

  g.pass(
    `${alias} -> ${dep} ${installed} matches range ${range} floor${covered}`,
  );
}
