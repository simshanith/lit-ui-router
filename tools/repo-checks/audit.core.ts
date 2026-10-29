// Pure logic for check-audit.ts, which owns the IO.

import semver from 'semver';
import * as v from 'valibot';

import { type Lock, parsePackageKey } from './single-version.core.ts';

/** pnpm's severity ladder, lowest first. */
export const SEVERITIES = [
  'info',
  'low',
  'moderate',
  'high',
  'critical',
] as const;

export type Severity = (typeof SEVERITIES)[number];

export const SeveritySchema = v.picklist(SEVERITIES);

const AdvisorySchema = v.object({
  module_name: v.string(),
  severity: SeveritySchema,
  // null when no version fixes it yet
  patched_versions: v.nullable(v.string()),
  github_advisory_id: v.string(),
  title: v.string(),
  url: v.string(),
  findings: v.array(v.object({ version: v.string() })),
});

/** The slice of `pnpm audit --json` the check reads. */
export const AuditSchema = v.object({
  advisories: v.record(v.string(), AdvisorySchema),
});

export type Advisory = v.InferOutput<typeof AdvisorySchema>;

/** One installed peer-floor alias, as one importer declares it. */
export type FloorAlias = {
  importer: string;
  alias: string;
  catalog: string;
  /** The real package and version the alias installs. */
  name: string;
  version: string;
  /** The importer's published peer range for `name`. */
  peerRange: string;
};

/** A dependency edge in `pnpm list --json` output, keyed there by alias. */
export type ListedDep = {
  from: string;
  version: string;
  path: string;
  /** Printed childless because its subtree appears elsewhere in the output. */
  deduped?: boolean;
  dependencies?: Record<string, ListedDep>;
  optionalDependencies?: Record<string, ListedDep>;
};

export type ListedProject = Partial<
  Record<
    'dependencies' | 'devDependencies' | 'optionalDependencies',
    Record<string, ListedDep>
  >
>;

const catalogOf = (specifier: string) =>
  /^catalog:(.*)$/.exec(specifier)?.[1] || 'default';

/**
 * Every importer's peerFloor* catalog alias, with the published peer range its
 * manifest declares for the real package. Throws when an importer declares no
 * peer range for its floor: there is nothing to judge the floor against.
 */
export function floorAliases(
  lock: Lock,
  catalogs: Readonly<Record<string, Record<string, string>>>,
  peerDependencies: (importer: string) => Record<string, string> | undefined,
): FloorAlias[] {
  const floors: FloorAlias[] = [];

  for (const [catalog, entries] of Object.entries(lock.catalogs ?? {})) {
    if (!catalog.startsWith('peerFloor')) continue;

    for (const [alias, { specifier }] of Object.entries(entries)) {
      const target = parsePackageKey(`${alias}@${specifier}`);

      if (!target) {
        throw new Error(
          `catalogs.${catalog}.${alias}: ${specifier} names no version`,
        );
      }

      for (const importer of importersOf(lock, alias, catalog)) {
        const spec = peerDependencies(importer)?.[target.name];

        const peerRange = spec?.startsWith('catalog:')
          ? catalogs[catalogOf(spec)]?.[target.name]
          : spec;

        if (!peerRange) {
          throw new Error(
            `${importer}: ${alias} (catalogs.${catalog}) floors ${target.name}, but no peerDependencies range for ${target.name} resolves`,
          );
        }

        floors.push({ importer, alias, catalog, ...target, peerRange });
      }
    }
  }

  return floors;
}

function* importersOf(
  lock: Lock,
  alias: string,
  catalog: string,
): Generator<string> {
  for (const [importer, groups] of Object.entries(lock.importers ?? {})) {
    for (const deps of Object.values(groups)) {
      if (deps?.[alias]?.specifier === `catalog:${catalog}`) yield importer;
    }
  }
}

const idOf = (dep: ListedDep) => `${dep.from}@${dep.version}`;

const childrenOf = (dep: ListedDep) =>
  Object.entries({ ...dep.dependencies, ...dep.optionalDependencies });

const rootEdges = (projects: readonly ListedProject[]) =>
  projects.flatMap((project) =>
    [
      project.dependencies,
      project.devDependencies,
      project.optionalDependencies,
    ].flatMap((deps) => Object.entries(deps ?? {})),
  );

/** `name@version` sets: reachable through a real edge, and per floor alias label. */
export type Partition = {
  real: Set<string>;
  /** id -> labels of the floor aliases it sits beneath. */
  floor: Map<string, Set<string>>;
};

export const floorLabel = (
  floor: Pick<FloorAlias, 'alias' | 'name' | 'version'>,
) => `${floor.alias} (${floor.name}@${floor.version})`;

/**
 * Split everything `pnpm list` reaches into what the shipped and tested tree
 * installs and what only a floor alias installs. A package reached both ways
 * counts as real.
 */
export function partition(
  projects: readonly ListedProject[],
  floors: readonly FloorAlias[],
): Partition {
  const subtrees = indexSubtrees(projects);

  const floorOf = (alias: string, dep: ListedDep) =>
    floors.find(
      (floor) =>
        floor.alias === alias &&
        floor.name === dep.from &&
        floor.version === dep.version,
    );

  const real = new Set<string>();
  const floorRoots = new Map<string, [string, ListedDep]>();

  walk(rootEdges(projects), subtrees, (alias, dep) => {
    const floor = floorOf(alias, dep);

    if (floor) {
      floorRoots.set(`${floorLabel(floor)}\0${dep.path}`, [
        floorLabel(floor),
        dep,
      ]);
    } else real.add(idOf(dep));

    return !floor;
  });

  const floor = new Map<string, Set<string>>();

  for (const [label, root] of floorRoots.values()) {
    walk([[label, root]], subtrees, (_alias, dep) => {
      const labels = floor.get(idOf(dep)) ?? new Set();

      labels.add(label);
      floor.set(idOf(dep), labels);

      return true;
    });
  }

  return { real, floor };
}

/** Children per installed path, from the one place pnpm prints each subtree. */
function indexSubtrees(
  projects: readonly ListedProject[],
): Map<string, [string, ListedDep][]> {
  const subtrees = new Map<string, [string, ListedDep][]>();
  const stack = rootEdges(projects).map(([, dep]) => dep);

  for (let dep = stack.pop(); dep; dep = stack.pop()) {
    const children = childrenOf(dep);

    if (!dep.deduped && !subtrees.has(dep.path)) {
      subtrees.set(dep.path, children);
    }

    stack.push(...children.map(([, child]) => child));
  }

  return subtrees;
}

/** Visit every edge below `roots` once per path; `enter` returning false prunes. */
function walk(
  roots: [string, ListedDep][],
  subtrees: ReadonlyMap<string, [string, ListedDep][]>,
  enter: (alias: string, dep: ListedDep) => boolean,
): void {
  const seen = new Set<string>();
  const stack = [...roots];

  for (let edge = stack.pop(); edge; edge = stack.pop()) {
    const [alias, dep] = edge;

    if (!enter(alias, dep) || seen.has(dep.path)) continue;
    seen.add(dep.path);

    const children = subtrees.get(dep.path);

    if (!children) {
      throw new Error(
        `pnpm list printed ${idOf(dep)} deduped but never in full`,
      );
    }

    stack.push(...children);
  }
}

export type Finding = {
  id: string;
  version: string;
  advisory: Advisory;
};

export type FloorFinding = Finding & { floors: string[] };

/** A floor-copy advisory with no patched version inside a published peer range. */
export type UnfixedFinding = Finding & { floor: FloorAlias };

export type Verdict = {
  real: Finding[];
  floorOnly: FloorFinding[];
  unfixedInRange: UnfixedFinding[];
};

/**
 * Sort audit findings into the real tree and floor-only copies. A finding
 * neither walk reached counts as real. A floor-only finding on the floor
 * target itself is unfixed in range when its patched versions miss the
 * importer's published peer range; transitive floor-only findings are not,
 * since consumers resolve those dependencies fresh.
 */
export function classify(
  advisories: readonly Advisory[],
  { real, floor }: Partition,
  floors: readonly FloorAlias[],
): Verdict {
  const verdict: Verdict = { real: [], floorOnly: [], unfixedInRange: [] };

  for (const advisory of advisories) {
    for (const { version } of advisory.findings) {
      const id = `${advisory.module_name}@${version}`;
      const finding = { id, version, advisory };
      const labels = floor.get(id);

      if (real.has(id) || !labels) {
        verdict.real.push(finding);
        continue;
      }

      verdict.floorOnly.push({ ...finding, floors: [...labels].sort() });

      for (const target of floors) {
        if (
          target.name === advisory.module_name &&
          target.version === version &&
          (advisory.patched_versions === null ||
            !semver.intersects(advisory.patched_versions, target.peerRange))
        ) {
          verdict.unfixedInRange.push({ ...finding, floor: target });
        }
      }
    }
  }

  return verdict;
}

export const atOrAbove = (severity: Severity, level: Severity) =>
  SEVERITIES.indexOf(severity) >= SEVERITIES.indexOf(level);

/** One line per floor alias: accepted finding counts, highest severity first. */
export function floorSummary(floorOnly: readonly FloorFinding[]): string[] {
  const counts = new Map<string, Map<Severity, number>>();

  for (const { floors, advisory } of floorOnly) {
    for (const label of floors) {
      const bySeverity = counts.get(label) ?? new Map<Severity, number>();

      bySeverity.set(
        advisory.severity,
        (bySeverity.get(advisory.severity) ?? 0) + 1,
      );

      counts.set(label, bySeverity);
    }
  }

  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, bySeverity]) => {
      const total = [...bySeverity.values()].reduce((sum, n) => sum + n, 0);

      const parts = [...SEVERITIES].reverse().flatMap((severity) => {
        const count = bySeverity.get(severity);

        return count === undefined ? [] : [`${count} ${severity}`];
      });

      return `${label}: ${total} accepted (${parts.join(', ')})`;
    });
}

export const formatFinding = ({ id, advisory }: Finding) =>
  `${advisory.severity} ${id} ${advisory.github_advisory_id} ${advisory.title} (patched ${advisory.patched_versions ?? 'nowhere'})`;

export const formatUnfixed = ({ floor, ...finding }: UnfixedFinding) =>
  `${formatFinding(finding)}: no patched version in ${floor.importer}'s published ${floor.name} peer range ${floor.peerRange}`;
