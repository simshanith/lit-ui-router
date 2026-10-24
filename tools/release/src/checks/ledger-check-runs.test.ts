import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GH, NPM, OTHER_SHA, ROWS, SHA } from '@tools/release-ledger/fixtures';
import * as v from 'valibot';

import {
  type GitHubRelease,
  type GitTag,
  type Inputs,
  LAG_MS,
  LEDGER_CHECK_RUN_NAME,
  type LedgerSnapshot,
  type Packument,
  digestFinding,
  LedgerSnapshotSchema,
  reconcile,
  releaseOf,
  toLedgerCheckRun,
} from './ledger-check-runs.core.ts';

const NAME = ROWS.released.name;

const VERSION = ROWS.released.version;

const RELEASE = `${NAME}@${VERSION}`;

const NOW = Date.parse(NPM.publishedAt) + 10 * LAG_MS;

const RECENT = new Date(NOW - LAG_MS / 2).toISOString();

const TAG: GitTag = { name: RELEASE, sha: SHA, at: NPM.publishedAt };

const GITHUB_RELEASE: GitHubRelease = {
  tag: RELEASE,
  id: GH.id,
  url: GH.url,
  prerelease: GH.prerelease,
  body: GH.body,
  publishedAt: GH.publishedAt,
  assets: [{ name: `${NAME}.tgz`, digest: 'sha256:abc' }],
};

const packument = (
  manifest: { integrity?: string; deprecated?: string } | null = {},
  distTags: Record<string, string> = { latest: VERSION },
  at = NPM.publishedAt,
): Packument => ({
  'dist-tags': distTags,
  time: { created: NPM.publishedAt, [VERSION]: at },
  versions:
    manifest === null
      ? {}
      : {
          [VERSION]: {
            dist: {
              integrity: manifest.integrity ?? NPM.integrity,
              tarball: 'https://registry.example/x.tgz',
            },
            ...(manifest.deprecated && { deprecated: manifest.deprecated }),
          },
        },
});

const LEDGER: LedgerSnapshot = {
  versions: [{ ...ROWS.released, status: 'released' }],
  distTags: [
    { name: NAME, tag: 'latest', version: VERSION, updated_at: 'then' },
  ],
};

const inputs = (overrides: Partial<Inputs> = {}): Inputs => ({
  ledger: LEDGER,
  tags: [TAG],
  releases: [GITHUB_RELEASE],
  npm: new Map([[NAME, packument()]]),
  now: NOW,
  ...overrides,
});

const rows = (row: Partial<LedgerSnapshot['versions'][number]>) => ({
  ...LEDGER,
  versions: [{ ...ROWS.released, status: 'released', ...row }],
});

const summary = (findings: ReturnType<typeof reconcile>) =>
  findings.map(({ level, message }) => `${level}: ${message}`);

describe('releaseOf', () => {
  it('reads <name>@<version> tags, scoped names included, and skips the rest', () => {
    assert.deepEqual(releaseOf('lit-ui-router@1.0.0-rc.1'), {
      name: 'lit-ui-router',
      version: '1.0.0-rc.1',
    });
    assert.deepEqual(releaseOf('@scope/pkg@2.0.0'), {
      name: '@scope/pkg',
      version: '2.0.0',
    });
    assert.equal(releaseOf('v0.1.0-alpha'), undefined);
    assert.equal(releaseOf('issue-reproduction/x/issues/69'), undefined);
    assert.equal(releaseOf('pkg@latest'), undefined);
  });
});

describe('LedgerSnapshotSchema', () => {
  it('keeps the fields the check reads and drops the rest', () => {
    const body = {
      versions: [
        {
          ...ROWS.released,
          npm_state: 'active',
          gh_state: 'final',
          status: 'released',
        },
      ],
      distTags: LEDGER.distTags,
    };

    assert.deepEqual(v.parse(LedgerSnapshotSchema, body), LEDGER);
  });

  it('throws on a body that is not the ledger', () => {
    assert.throws(() => v.parse(LedgerSnapshotSchema, { versions: [{}] }));
  });
});

describe('reconcile', () => {
  it('finds nothing when every source agrees', () => {
    assert.deepEqual(reconcile(inputs()), []);
  });

  it('reports a recorded conflict', () => {
    const findings = reconcile(
      inputs({
        ledger: rows({ gh_conflict: '{"gh":null}', status: 'conflict' }),
      }),
    );

    assert.deepEqual(summary(findings), [
      'action: the ledger records a gh conflict: `{"gh":null}`',
    ]);
  });

  it('reports a moved and a deleted tag', () => {
    assert.deepEqual(
      summary(reconcile(inputs({ tags: [{ ...TAG, sha: OTHER_SHA }] }))),
      [
        `action: the tag moved: the ledger has ${SHA.slice(0, 7)}, GitHub fffffff`,
      ],
    );
    assert.deepEqual(summary(reconcile(inputs({ tags: [] }))), [
      'action: the tag is gone from GitHub',
    ]);
  });

  it('reports an unpublished version and a mismatched integrity', () => {
    assert.deepEqual(
      summary(
        reconcile(inputs({ npm: new Map([[NAME, packument(null, {})]]) })),
      ),
      [
        'action: npm no longer has this version',
        `action: dist-tag \`latest\`: the ledger has ${VERSION}, npm none`,
      ],
    );
    assert.deepEqual(
      summary(
        reconcile(
          inputs({
            npm: new Map([[NAME, packument({ integrity: 'sha512-BBBB' })]]),
          }),
        ),
      ),
      ["action: npm's integrity differs from the ledger's"],
    );
  });

  it('treats a whole package 404 as every version unpublished', () => {
    assert.deepEqual(
      summary(reconcile(inputs({ npm: new Map([[NAME, null]]) }))),
      ['action: npm no longer has this version'],
    );
  });

  it('notes a deprecation without a verdict', () => {
    const findings = reconcile(
      inputs({ npm: new Map([[NAME, packument({ deprecated: 'use 2.0' })]]) }),
    );

    assert.deepEqual(summary(findings), [
      'info: npm marks this version deprecated: use 2.0',
    ]);
  });

  it('skips npm for a package whose packument was unreachable', () => {
    assert.deepEqual(reconcile(inputs({ npm: new Map() })), []);
  });

  it('reports a deleted, replaced or edited release', () => {
    assert.deepEqual(summary(reconcile(inputs({ releases: [] }))), [
      'action: the GitHub release is gone',
      'action: on npm without a final GitHub release',
    ]);
    assert.deepEqual(
      summary(reconcile(inputs({ releases: [{ ...GITHUB_RELEASE, id: 7 }] }))),
      ['action: the GitHub release was replaced'],
    );
    assert.deepEqual(
      summary(
        reconcile(
          inputs({
            releases: [{ ...GITHUB_RELEASE, body: 'edited', prerelease: true }],
          }),
        ),
      ),
      [
        "action: the release's prerelease flag changed",
        "action: the release's notes were edited on GitHub",
      ],
    );
  });

  it('reads a null release body as the empty one the ledger records', () => {
    const ledger = rows({ gh_body: '' });

    assert.deepEqual(
      reconcile(
        inputs({ ledger, releases: [{ ...GITHUB_RELEASE, body: null }] }),
      ),
      [],
    );
  });

  it('notes what the ledger has not recorded yet within the lag window, and flags it after', () => {
    const empty = { versions: [], distTags: [] };

    const fresh = inputs({
      ledger: empty,
      tags: [{ ...TAG, at: RECENT }],
      releases: [{ ...GITHUB_RELEASE, publishedAt: RECENT }],
      npm: new Map([[NAME, packument({}, { latest: VERSION }, RECENT)]]),
    });

    assert.deepEqual(summary(reconcile(fresh)), [
      'info: the ledger has not recorded the tag',
      'info: the ledger has not recorded the npm publish',
      'info: the ledger has not recorded the GitHub release',
      `info: dist-tag \`latest\`: the ledger has none, npm ${VERSION}`,
    ]);
    assert.deepEqual(summary(reconcile(inputs({ ledger: empty }))), [
      'action: the ledger has not recorded the tag',
      'action: the ledger has not recorded the npm publish',
      'action: the ledger has not recorded the GitHub release',
      `action: dist-tag \`latest\`: the ledger has none, npm ${VERSION}`,
    ]);
  });

  it('applies the pipeline lag rules', () => {
    const tagged = inputs({
      ledger: {
        versions: [{ ...ROWS.tagged, status: 'tagged' }],
        distTags: [],
      },
      releases: [],
      npm: new Map([[NAME, packument(null, {})]]),
    });

    assert.deepEqual(summary(reconcile(tagged)), [
      'action: tagged, but not on npm: a publish run stopped before npm',
    ]);

    const ahead = inputs({
      ledger: {
        versions: [{ ...ROWS.releasedFirst, status: 'tagged' }],
        distTags: [],
      },
      releases: [{ ...GITHUB_RELEASE, publishedAt: RECENT }],
      npm: new Map([[NAME, packument(null, {})]]),
    });

    assert.deepEqual(summary(reconcile(ahead)), [
      'info: a final GitHub release ahead of npm',
    ]);
  });

  it('flags a release without a tag', () => {
    const ledger = rows({ git_sha: null, status: 'untagged' });

    assert.deepEqual(summary(reconcile(inputs({ ledger, tags: [] }))), [
      'action: published without a tag',
    ]);
  });

  it('reports a moved dist-tag and ignores npm tags on versions the ledger never saw', () => {
    const moved = inputs({
      npm: new Map([[NAME, packument({}, { latest: '0.9.0' })]]),
    });

    assert.deepEqual(summary(reconcile(moved)), [
      `action: dist-tag \`latest\`: the ledger has ${VERSION}, npm 0.9.0`,
    ]);

    const legacy = inputs({
      npm: new Map([
        [NAME, packument({}, { latest: VERSION, alpha: '0.0.1' })],
      ]),
    });

    assert.deepEqual(reconcile(legacy), []);
  });

  it('orders action findings before notes', () => {
    const findings = reconcile(
      inputs({
        tags: [{ ...TAG, sha: OTHER_SHA }],
        npm: new Map([[NAME, packument({ deprecated: 'x' })]]),
      }),
    );

    assert.deepEqual(
      findings.map(({ level }) => level),
      ['action', 'info'],
    );
  });
});

describe('digestFinding', () => {
  it('compares the .tgz asset against the npm tarball sha256', () => {
    assert.equal(
      digestFinding(RELEASE, { digest: 'sha256:abc' }, 'abc').level,
      'info',
    );
    assert.equal(
      digestFinding(RELEASE, { digest: 'sha256:def' }, 'abc').level,
      'action',
    );
    assert.equal(digestFinding(RELEASE, undefined, 'abc').level, 'action');
    assert.equal(digestFinding(RELEASE, undefined, undefined).level, 'info');
  });
});

describe('toLedgerCheckRun', () => {
  it('maps no findings to success', () => {
    const payload = toLedgerCheckRun([], []);

    assert.equal(payload.name, LEDGER_CHECK_RUN_NAME);
    assert.equal(payload.conclusion, 'success');
  });

  it('keeps success with only notes, and lists them', () => {
    const payload = toLedgerCheckRun(
      [{ release: RELEASE, level: 'info', message: 'deprecated' }],
      [],
    );

    assert.equal(payload.conclusion, 'success');
    assert.match(payload.summary, /deprecated/);
  });

  it('maps a disagreement to action_required, even with a source unreachable', () => {
    const payload = toLedgerCheckRun(
      [{ release: RELEASE, level: 'action', message: 'the tag moved' }],
      ['npm x: HTTP 503'],
    );

    assert.equal(payload.conclusion, 'action_required');
    assert.match(payload.title, /1 disagreement/);
    assert.match(payload.summary, /the tag moved/);
    assert.match(payload.summary, /HTTP 503/);
  });

  it('maps an unreachable source to neutral, never failure', () => {
    const payload = toLedgerCheckRun([], ['ledger: GET /ledger: HTTP 401']);

    assert.equal(payload.conclusion, 'neutral');
    assert.match(payload.summary, /HTTP 401/);
  });
});
