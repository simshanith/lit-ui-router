#!/usr/bin/env node
// Each installed floor alias must equal the floor of its leg of the <dep> range
// in the catalog the package's peer or dependency names, or the floor lane lies.
// Usage (from the package dir): floor-guard
import { readManifest } from '@tools/bootstrap/manifest.ts';

import { legWindow, parseFloorAlias, proveLegs } from './floor-legs.ts';
import { type Guard, guard } from './guard.ts';

// annotated: TS only treats `g.fail` as never-returning through a dotted name
// whose type is explicit, and the catalog fallback below relies on that narrowing
const g: Guard = guard('floor-guard');

const manifest = readManifest(process.cwd());

const catalogName = (spec: string | undefined) =>
  spec?.match(/^catalog:(\w+)$/)?.[1];

// a floor alias is a devDependency named <dep>-floor or <dep>-<line>-floor:
// fed by a peerFloor* catalog for a peer, or by any catalog for a dependency
const aliases = Object.entries(manifest?.devDependencies ?? {}).flatMap(
  ([alias, spec]) => {
    const parsed = parseFloorAlias(alias);

    if (parsed === undefined) return [];

    const catalog = catalogName(spec);

    const fed =
      catalog?.startsWith('peerFloor') === true ||
      parsed.dep in (manifest?.dependencies ?? {});

    return fed ? [{ alias, dep: parsed.dep, catalog }] : [];
  },
);

const deps = [...new Set(aliases.map(({ dep }) => dep))];

if (deps.length === 0) {
  g.fail(
    `${process.cwd()} declares no <dep>-floor devDependency for a peer from a ` +
      'peerFloor* catalog, or for a dependency.',
  );
}

for (const dep of deps) {
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
  const own = aliases.filter((entry) => entry.dep === dep);

  const { failures, proofs } = proveLegs({
    dep,
    kind,
    catalog,
    range,
    floorCatalog:
      own.find(({ alias }) => alias === `${dep}-floor`)?.catalog ??
      own[0]?.catalog ??
      'floor',
    aliases: Object.fromEntries(
      own.map(({ alias }) => [alias, g.installed(alias, dep)]),
    ),
    dev: () => g.installed(dep, dep),
  });

  if (failures.length > 0) g.fail(failures.join('\n'));

  const devSpec = manifest?.devDependencies?.[dep];

  for (const warning of legWindow({
    dependent: manifest?.name ?? process.cwd(),
    dep,
    kind,
    range,
    workspace:
      devSpec === 'catalog:workspace' ||
      devSpec?.startsWith('workspace:') === true,
    dev: () => g.installed(dep, dep),
  })) {
    g.warn(warning);
  }

  g.pass(`${dep} range ${range}: ${proofs.join('; ')}`);
}
