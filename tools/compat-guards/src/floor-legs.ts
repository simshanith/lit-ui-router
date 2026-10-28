// Pure logic for floor-guard.ts, which owns the IO.
import semver from 'semver';

import { rangeLegs } from './ranges.ts';

// a dep whose own name ends in -<digits> reads as a leg alias and fails loudly
const LEG_ALIAS = /^(.+)-(\d+(?:\.\d+){0,2})-floor$/u;

export interface FloorAlias {
  /** The package the alias floors. */
  dep: string;
  /** The line of a per-leg alias (`0.3` in `ui-router-server-0.3-floor`). */
  line?: string;
}

/** The dep a `<dep>-floor` or `<dep>-<line>-floor` alias floors. */
export function parseFloorAlias(alias: string): FloorAlias | undefined {
  if (!alias.endsWith('-floor')) return undefined;

  const [, dep, line] = LEG_ALIAS.exec(alias) ?? [];

  if (dep !== undefined && line !== undefined) return { dep, line };

  return { dep: alias.slice(0, -'-floor'.length) };
}

/** The line a leg floor opens: its major, or `0.<minor>` below 1.0. */
export function legLine(floor: string): string {
  const version = semver.parse(floor);

  if (version === null) throw new Error(`"${floor}" is not a version`);

  if (version.major > 0) return `${version.major}`;

  if (version.minor > 0) return `0.${version.minor}`;

  return `0.0.${version.patch}`;
}

/** The alias that proves a middle leg opening at `floor`. */
export function legAlias(dep: string, floor: string): string {
  return `${dep}-${legLine(floor)}-floor`;
}

export interface FloorLegs {
  dep: string;
  kind: 'dependency' | 'peer';
  /** The catalog the published range comes from. */
  catalog: string;
  range: string;
  /** The catalog the `<dep>-floor` alias comes from, named in fixes. */
  floorCatalog: string;
  /** Installed version of each floor alias of `dep` the package declares. */
  aliases: Readonly<Record<string, string>>;
  /** Installed version of the `dep` devDependency; read only for 2+ legs. */
  dev: () => string;
}

export interface LegVerdict {
  failures: string[];
  proofs: string[];
}

/**
 * The lowest leg is proven by `<dep>-floor`, each middle leg by its own
 * `<dep>-<line>-floor`, and the top leg by the dev dependency every other lane
 * runs on. Once the dev dependency is released past the range, the top leg
 * falls back to its own `<dep>-<line>-floor` until the range widens. Every
 * alias must pin its leg's floor exactly.
 */
export function proveLegs(input: FloorLegs): LegVerdict {
  const { dep, catalog, range, floorCatalog, aliases } = input;
  const failures: string[] = [];
  const proofs: string[] = [];

  const expect = (alias: string, leg: string, floor: string) => {
    const installed = aliases[alias];

    if (installed === undefined) {
      failures.push(
        `${catalog} ${dep} range "${range}" has a leg "${leg}" that no alias ` +
          `proves. Add ${alias}: npm:${dep}@${floor} to the ${floorCatalog} ` +
          `catalog, declare it as a devDependency, and reinstall.`,
      );
    } else if (installed !== floor) {
      failures.push(
        `${alias} resolves to ${installed}, but the floor of the ${input.kind} ` +
          `range ${range} leg "${leg}" is ${floor}. Repin the alias in the ` +
          `${floorCatalog} catalog in pnpm-workspace.yaml and reinstall.`,
      );
    } else {
      proofs.push(`${alias} -> ${dep} ${installed} proves "${leg}"`);
    }
  };

  const [lowest, ...upper] = rangeLegs(range);

  if (lowest === undefined) {
    return {
      failures: [
        `semver cannot name a floor for ${catalog} ${dep} "${range}".`,
      ],
      proofs,
    };
  }

  expect(`${dep}-floor`, lowest.range, lowest.floor);

  const top = upper.pop();
  const expected = new Set([`${dep}-floor`]);

  for (const { range: leg, floor } of upper) {
    const alias = legAlias(dep, floor);

    expected.add(alias);
    expect(alias, leg, floor);
  }

  if (top !== undefined) {
    const dev = input.dev();
    const topAlias = legAlias(dep, top.floor);
    const pinned = aliases[topAlias] !== undefined;

    if (pinned) expected.add(topAlias);

    if (semver.satisfies(dev, top.range)) {
      proofs.push(`dev ${dep} ${dev} runs "${top.range}"`);

      // an alias added ahead of the release must already pin the top leg's floor
      if (pinned) expect(topAlias, top.range, top.floor);
    } else if (semver.gtr(dev, top.range) && pinned) {
      expect(topAlias, top.range, top.floor);
      proofs.push(
        `dev ${dep} ${dev} is past "${range}"; widen the ${catalog} range to admit it`,
      );
    } else if (semver.gtr(dev, top.range)) {
      failures.push(
        `${catalog} ${dep} range "${range}" has a top leg "${top.range}" that ` +
          `the ${dep} devDependency (${dev}) has moved past. Add ` +
          `${topAlias}: npm:${dep}@${top.floor} to the ${floorCatalog} ` +
          'catalog, declare it as a devDependency, and reinstall, or widen ' +
          'the range.',
      );
    } else {
      failures.push(
        `${catalog} ${dep} range "${range}" has a top leg "${top.range}" that ` +
          `the ${dep} devDependency (${dev}) does not exercise. Move the ` +
          'devDependency into it, or narrow the range.',
      );
    }
  }

  for (const alias of Object.keys(aliases)) {
    if (!expected.has(alias)) {
      failures.push(
        `${alias} proves no leg of ${catalog} ${dep} range "${range}". ` +
          `Remove it from the ${floorCatalog} catalog and the devDependencies.`,
      );
    }
  }

  return { failures, proofs };
}

export interface LegWindow {
  /** The package whose manifest declares the peer. */
  dependent: string;
  dep: string;
  kind: 'dependency' | 'peer';
  range: string;
  /** Whether the dep is a workspace package. */
  workspace: boolean;
  /** Installed version of the `dep` devDependency; read only past two legs. */
  dev: () => string;
}

/**
 * Warnings for a peer range on a 0.x workspace package that keeps legs below
 * its newest two; empty otherwise. Advisory: dropping a leg takes a release.
 */
export function legWindow(input: LegWindow): string[] {
  const { dependent, dep, range } = input;

  if (input.kind !== 'peer' || !input.workspace) return [];

  const legs = range
    .split('||')
    .flatMap((text) => {
      const leg = text.trim();
      const floor = semver.minVersion(leg);

      return floor === null ? [] : [{ leg, floor }];
    })
    .sort((a, b) => semver.compare(a.floor, b.floor));

  if (legs.length <= 2 || semver.major(input.dev()) > 0) return [];

  return legs
    .slice(0, -2)
    .map(
      ({ leg }) =>
        `${dependent} peer ${dep} range "${range}" keeps ${legs.length} ` +
        `legs. "${leg}" is outside the two-leg window; drop it in the next ` +
        `${dependent} minor.`,
    );
}
