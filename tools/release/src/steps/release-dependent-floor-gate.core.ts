// Pure decisions for the bump-time dependent floor gate. While a dependent's
// <pkg>-floor alias equals the workspace version, pnpm links it to the
// workspace copy and both floor-guard and the bundle probe accept it; the bump
// moves the workspace off the floor, so this is the earliest point a dependent
// can be proven against its published floor. The IO (install, turbo) lives in
// ./release-dependent-floor-gate.ts.

import { isPublishable, type Member } from '@tools/shared/workspace.ts';

import { PEER_FLOOR_SCRIPT } from '../checks/peer-floor-check-runs.core.ts';

export const BUNDLE_SCRIPT = 'check:bundle';

/** A published package whose published range names the bumped package. */
export type Dependent = {
  name: string;
  kind: 'peer' | 'dependency';
  /** catalog the published range comes from, e.g. `publishedPeerSsr` */
  rangeCatalog?: string;
  /** catalog pinning the `<pkg>-floor` alias, e.g. `peerFloorSsr` */
  floorCatalog?: string;
  /** turbo argv running the dependent's guards */
  turboArgs: string[];
};

const catalogName = (spec: string | undefined): string | undefined =>
  spec?.match(/^catalog:(\w+)$/)?.[1];

const guardScripts = (member: Member): string[] =>
  [BUNDLE_SCRIPT, PEER_FLOOR_SCRIPT].filter(
    (script) => member.manifest?.scripts?.[script] !== undefined,
  );

/** Published dependents of `packageName` that define a floor guard, by name. */
export function dependentsOf(
  packageName: string,
  members: readonly Member[],
): Dependent[] {
  if (!members.some((member) => member.name === packageName)) {
    throw new Error(
      `package ${JSON.stringify(packageName)} is not a workspace member`,
    );
  }

  return members
    .filter(isPublishable)
    .flatMap((member): Dependent[] => {
      const { manifest } = member;
      const peer = manifest.peerDependencies?.[packageName];
      const spec = peer ?? manifest.dependencies?.[packageName];
      const scripts = guardScripts(member);

      if (member.name === packageName || spec === undefined) return [];

      if (scripts.length === 0) return [];

      return [
        {
          name: member.name,
          kind: peer === undefined ? 'dependency' : 'peer',
          rangeCatalog: catalogName(spec),
          floorCatalog: catalogName(
            manifest.devDependencies?.[`${packageName}-floor`],
          ),
          turboArgs: ['run', ...scripts, `--filter=${member.name}`],
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** pnpm argv relinking the dependents' floor aliases from the fixed lockfile. */
export function installArgs(dependents: readonly Dependent[]): string[] {
  return [
    'install',
    '--frozen-lockfile',
    ...dependents.map(({ name }) => `--filter=${name}`),
  ];
}

/** Why the release stops, and the way through, for each failed dependent. */
export function failureMessage(options: {
  packageName: string;
  version: string;
  failed: readonly Dependent[];
  /** current published range per catalog, read from pnpm-workspace.yaml */
  rangeOf: (catalog: string | undefined) => string | undefined;
}): string {
  const { packageName, version, failed, rangeOf } = options;
  const needs = `^${version}`;

  const lines = failed.map((dependent) => {
    const range = rangeOf(dependent.rangeCatalog) ?? '<unknown>';
    const rangeCatalog = dependent.rangeCatalog ?? '<no catalog>';
    const floorCatalog = dependent.floorCatalog ?? '<no floor catalog>';

    return [
      `${dependent.name}: its ${packageName} ${dependent.kind} floor no longer proves "${range}" once the workspace moves to ${version}; it needs "${needs}".`,
      `  - release ${packageName}@${version} from a main without ${dependent.name}'s change that needs it,`,
      `  - then narrow ${rangeCatalog} ${packageName} to "${needs}" and repin ${packageName}-floor in ${floorCatalog} to ${version} in a PR on main.`,
    ].join('\n');
  });

  return [
    `${packageName}@${version} would release with ${failed.length} dependent(s) whose floor guards fail:`,
    ...lines,
  ].join('\n');
}
