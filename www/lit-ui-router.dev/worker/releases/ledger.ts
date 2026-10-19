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

/** The RPC methods of the ledger worker's `LedgerReader` entrypoint that these pages call. */
export interface LedgerReader {
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

/** Each package's npm `latest` row, or null where the ledger has none. */
export const latestOf =
  (ledger: LedgerReader) =>
  (names: readonly string[]): Promise<(LedgerVersion | null)[]> =>
    Promise.all(names.map((name) => ledger.tagged(name, 'latest')));

/** A package's versions, newest first by semver precedence. */
export const versionsOf =
  (ledger: LedgerReader) =>
  async ({ pkg }: { pkg: string }): Promise<LedgerVersion[]> =>
    [...(await ledger.versions(pkg))].sort((a, b) =>
      rcompare(a.version, b.version),
    );

/** One version's row from its package's list, or a `NotInLedger` rejection. */
export const versionIn = (
  versions: readonly LedgerVersion[],
  { pkg, version }: { pkg: string; version: string },
): LedgerVersion => {
  const row = versions.find((candidate) => candidate.version === version);

  if (!row) throw new NotInLedger(`${pkg}@${version}`);

  return row;
};

/** The version npm's `latest` dist-tag points at, or a `NotInLedger` rejection. */
export const latestVersionOf =
  (ledger: LedgerReader) =>
  async ({ pkg }: { pkg: string }): Promise<string> => {
    const row = await ledger.tagged(pkg, 'latest');

    if (!row) throw new NotInLedger(`${pkg}@latest`);

    return row.version;
  };
