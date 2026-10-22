// The ledger reads the release pages make, each a `(params) => query` over the LedgerReader service binding.
import type {
  GhState,
  NpmState,
  Status,
  VersionRow,
} from '@tools/release-ledger';
import prerelease from 'semver/functions/prerelease.js';
import rcompare from 'semver/functions/rcompare.js';

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
export const previousIn = <Row extends { version: string }>(
  versions: readonly Row[],
  row: Row,
): Row | null => {
  const at = versions.findIndex(({ version }) => version === row.version);

  if (at === -1) return null;

  const older = versions.slice(at + 1);

  return (
    (isStable(row.version)
      ? older.find(({ version }) => isStable(version))
      : older[0]) ?? null
  );
};

/** Two versions to compare, older first; either is absent for a package with no versions. */
export interface VersionPair<Row> {
  from: Row | undefined;
  to: Row | undefined;
}

/** Two versions the ledger records as published to npm, older or newer first. */
export interface PublishedPair {
  from: LedgerVersion;
  to: LedgerVersion;
}

/** The pair a diff picker starts on: the newest stable version, or the newest, and the version before it, or the oldest. */
export const pickerPair = <Row extends { version: string }>(
  versions: readonly Row[],
): VersionPair<Row> => {
  const to = versions.find(({ version }) => isStable(version)) ?? versions[0];

  return { from: (to && previousIn(versions, to)) ?? versions.at(-1), to };
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
