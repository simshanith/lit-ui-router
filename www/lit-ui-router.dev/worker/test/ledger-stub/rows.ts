// Fixture ledger rows, served by the stub LedgerReader in node tests, workerd tests and local dev.
import type { VersionRow } from '@tools/release-ledger';
import { ROWS } from '@tools/release-ledger/fixtures';

import type { LedgerReader, LedgerVersion } from '../../releases/ledger.ts';

const releaseUrl = (name: string, version: string) =>
  `https://github.com/simshanith/lit-ui-router/releases/tag/${encodeURIComponent(`${name}@${version}`)}`;

const row = (
  base: VersionRow,
  name: string,
  version: string,
  states: Pick<LedgerVersion, 'npm_state' | 'gh_state' | 'status'>,
): LedgerVersion => ({
  ...base,
  name,
  version,
  gh_url: base.gh_url === null ? null : releaseUrl(name, version),
  ...states,
});

const RELEASED = {
  npm_state: 'active',
  gh_state: 'final',
  status: 'released',
} as const;

/** Oldest first, as the ledger's `versions` returns them. */
export const FIXTURE_ROWS: readonly LedgerVersion[] = [
  row(ROWS.released, 'lit-ui-router', '1.2.0', RELEASED),
  row(ROWS.deprecated, 'lit-ui-router', '1.9.0', {
    npm_state: 'deprecated',
    gh_state: 'none',
    status: 'published',
  }),
  row(ROWS.released, 'lit-ui-router', '1.10.0', RELEASED),
  row(ROWS.published, 'lit-ui-router', '1.11.0-rc.0', {
    npm_state: 'active',
    gh_state: 'none',
    status: 'published',
  }),
  row(ROWS.released, 'ui-router-server', '0.3.0', RELEASED),
];

/** npm's `latest` dist-tag per package. */
export const FIXTURE_LATEST = new Map([
  ['lit-ui-router', '1.10.0'],
  ['ui-router-server', '0.3.0'],
]);

/** A LedgerReader over the fixture rows. */
export const fixtureLedger: LedgerReader = {
  tagged: (name, tag) =>
    Promise.resolve(
      tag === 'latest'
        ? (FIXTURE_ROWS.find(
            (candidate) =>
              candidate.name === name &&
              candidate.version === FIXTURE_LATEST.get(name),
          ) ?? null)
        : null,
    ),
  versions: (name) =>
    Promise.resolve(
      FIXTURE_ROWS.filter((candidate) => candidate.name === name),
    ),
};
