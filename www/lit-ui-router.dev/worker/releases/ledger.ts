// The ledger reads the release pages make, each a `(params) => query` over the LedgerReader service binding.
import type {
  GhState,
  NpmState,
  Status,
  VersionRow,
} from '@tools/release-ledger';
import { prerelease, rcompare } from 'semver';

/** A `versions` row with the states the ledger's `version_states` view derives. */
export interface LedgerVersion extends VersionRow {
  npm_state: NpmState;
  gh_state: GhState;
  status: Status;
}

/** A package the ledger has recorded, with the version its npm `latest` dist-tag points at. */
export interface LedgerPackage {
  name: string;
  latest: LedgerVersion | null;
}

/** The RPC methods of the ledger worker's `LedgerReader` entrypoint that these pages call. */
export interface LedgerReader {
  /** Every package with a recorded version, by name, each with its `latest` row or null. */
  packages(): Promise<readonly LedgerPackage[]>;
  tagged(name: string, tag: string): Promise<LedgerVersion | null>;
  versions(name: string): Promise<readonly LedgerVersion[]>;
}

/** A package or version the ledger has no row for. */
export class NotInLedger extends Error {
  override name = 'NotInLedger';
}

/** Whether a version is stable: no prerelease identifiers. */
export const isStable = (version: string): boolean =>
  prerelease(version) === null;

/**
 * The version `row` follows in `versions` (newest first): the next older stable for a stable
 * version, the next older of any kind for a prerelease, or null for the first.
 */
export const previousIn = (
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
): LedgerVersion | null => {
  const at = versions.findIndex(({ version }) => version === row.version);

  if (at === -1) return null;

  const older = versions.slice(at + 1);

  return (
    (isStable(row.version)
      ? older.find(({ version }) => isStable(version))
      : older[0]) ?? null
  );
};

/** Every package the ledger has recorded, with its npm `latest` row. */
export const packagesOf =
  (ledger: LedgerReader) => (): Promise<readonly LedgerPackage[]> =>
    ledger.packages();

/** A package's versions, newest first by semver precedence, or a `NotInLedger` rejection for a package with none. */
export const versionsOf =
  (ledger: LedgerReader) =>
  async ({ pkg }: { pkg: string }): Promise<LedgerVersion[]> => {
    const versions = await ledger.versions(pkg);

    if (versions.length === 0) throw new NotInLedger(pkg);

    return [...versions].sort((a, b) => rcompare(a.version, b.version));
  };

/** One version's row from its package's list, or a `NotInLedger` rejection. */
export const versionIn = (
  versions: readonly LedgerVersion[],
  { pkg, version }: { pkg: string; version: string },
): LedgerVersion => {
  const row = versions.find((candidate) => candidate.version === version);

  if (!row) throw new NotInLedger(`${pkg}@${version}`);

  return row;
};

/** The row npm's `latest` dist-tag points at, or a `NotInLedger` rejection. */
export const latestOf =
  (ledger: LedgerReader) =>
  async ({ pkg }: { pkg: string }): Promise<LedgerVersion> => {
    const row = await ledger.tagged(pkg, 'latest');

    if (!row) throw new NotInLedger(`${pkg}@latest`);

    return row;
  };
