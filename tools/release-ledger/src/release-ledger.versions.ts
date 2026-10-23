// A package's versions in release order: newest first by semver precedence, and the version each one follows.
import prerelease from 'semver/functions/prerelease.js';
import rcompare from 'semver/functions/rcompare.js';

/** Whether a version is stable: no prerelease identifiers. */
export const isStable = (version: string): boolean =>
  prerelease(version) === null;

/** `rows`, newest first by semver precedence. */
export const newestFirst = <Row extends { version: string }>(
  rows: readonly Row[],
): Row[] => [...rows].sort((a, b) => rcompare(a.version, b.version));

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
