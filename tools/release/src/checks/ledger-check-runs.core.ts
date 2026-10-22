// Pure reconcile: the ledger's rows against GitHub's tags and releases and npm's
// packuments, as findings, then one Checks API payload. Report only; the IO
// lives in ./ledger-check-runs.ts.

import type { DistTagRow, VersionRow } from '@tools/release-ledger';
import semver from 'semver';
import * as v from 'valibot';

import type { CheckRunPayload } from './publish-check-runs.core.ts';

export const LEDGER_CHECK_RUN_NAME = 'release-ledger';

/** #1430's lag rule: a step missing for longer than this means a run stopped partway. */
export const LAG_MS = 60 * 60 * 1000;

const LedgerVersionSchema = v.object({
  name: v.string(),
  version: v.string(),
  first_seen_at: v.string(),
  git_sha: v.nullable(v.string()),
  tag_conflict: v.nullable(v.string()),
  npm_integrity: v.nullable(v.string()),
  npm_published_at: v.nullable(v.string()),
  npm_deprecated: v.nullable(v.string()),
  npm_conflict: v.nullable(v.string()),
  gh_release_id: v.nullable(v.number()),
  gh_url: v.nullable(v.string()),
  gh_prerelease: v.nullable(v.number()),
  gh_body: v.nullable(v.string()),
  gh_published_at: v.nullable(v.string()),
  gh_conflict: v.nullable(v.string()),
  status: v.string(),
});

/** The body of the ledger worker's GET /ledger. */
export const LedgerSnapshotSchema: v.GenericSchema<unknown, LedgerSnapshot> =
  v.object({
    versions: v.array(LedgerVersionSchema),
    distTags: v.array(
      v.object({
        name: v.string(),
        tag: v.string(),
        version: v.string(),
        updated_at: v.string(),
      }),
    ),
  });

export type LedgerSnapshot = {
  versions: (VersionRow & { status: string })[];
  distTags: DistTagRow[];
};

/** One `{ name, sha, at }` line of the tag listing, `sha` the peeled commit. */
export const GitTagSchema = v.object({
  name: v.string(),
  sha: v.string(),
  at: v.string(),
});

export type GitTag = v.InferOutput<typeof GitTagSchema>;

/** One published release line of the release listing. */
export const GitHubReleaseSchema = v.object({
  tag: v.string(),
  id: v.number(),
  url: v.string(),
  prerelease: v.boolean(),
  body: v.nullable(v.string()),
  publishedAt: v.string(),
  assets: v.array(
    v.object({ name: v.string(), digest: v.nullable(v.string()) }),
  ),
});

export type GitHubRelease = v.InferOutput<typeof GitHubReleaseSchema>;

/** The packument fields the check reads. */
export const PackumentSchema = v.object({
  'dist-tags': v.optional(v.record(v.string(), v.string()), {}),
  // `unpublished` holds an object; a version's time is always a string.
  time: v.optional(v.record(v.string(), v.fallback(v.string(), '')), {}),
  versions: v.optional(
    v.record(
      v.string(),
      v.object({
        dist: v.object({ integrity: v.string(), tarball: v.string() }),
        deprecated: v.optional(v.string()),
      }),
    ),
    {},
  ),
});

export type Packument = v.InferOutput<typeof PackumentSchema>;

/** `action` turns the check orange; `info` is a summary line. */
export type Finding = {
  release: string;
  level: 'action' | 'info';
  message: string;
};

export type Inputs = {
  ledger: LedgerSnapshot;
  tags: readonly GitTag[];
  releases: readonly GitHubRelease[];
  /** A package's packument, `null` when npm answers 404, absent when npm could not be read. */
  npm: ReadonlyMap<string, Packument | null>;
  now: number;
};

/** The `<name>@<version>` a release tag names, or undefined for any other tag. */
export function releaseOf(
  tag: string,
): { name: string; version: string } | undefined {
  const at = tag.lastIndexOf('@');

  if (at <= 0) return undefined;

  const version = tag.slice(at + 1);

  return semver.valid(version) === version
    ? { name: tag.slice(0, at), version }
    : undefined;
}

/** Every package the ledger or a release tag names. */
export function packagesOf(
  ledger: LedgerSnapshot,
  tags: readonly GitTag[],
  releases: readonly GitHubRelease[],
): string[] {
  const names = new Set(ledger.versions.map(({ name }) => name));

  for (const tag of [
    ...tags.map(({ name }) => name),
    ...releases.map((r) => r.tag),
  ]) {
    const release = releaseOf(tag);

    if (release) names.add(release.name);
  }

  return [...names].sort();
}

type NpmVersion = { integrity: string; deprecated: string | null; at: string };

type Key = {
  release: string;
  row: LedgerSnapshot['versions'][number] | undefined;
  tag: GitTag | undefined;
  gh: GitHubRelease | undefined;
  /** `undefined` when the package's packument could not be read. */
  npm: NpmVersion | null | undefined;
};

const short = (sha: string): string => sha.slice(0, 7);

const npmVersionOf = (
  packument: Packument | null | undefined,
  version: string,
): NpmVersion | null | undefined => {
  if (packument === undefined) return undefined;

  const manifest = packument?.versions[version];

  if (!manifest) return null;

  return {
    integrity: manifest.dist.integrity,
    deprecated: manifest.deprecated ?? null,
    at: packument.time[version] ?? '',
  };
};

function keysOf({ ledger, tags, releases, npm }: Inputs): Key[] {
  const rows = new Map(
    ledger.versions.map((row) => [`${row.name}@${row.version}`, row]),
  );

  const tagged = new Map(tags.map((tag) => [tag.name, tag]));
  const released = new Map(releases.map((release) => [release.tag, release]));
  const names = [...rows.keys(), ...tagged.keys(), ...released.keys()];

  return [...new Set(names)].sort().flatMap((release): Key[] => {
    const parsed = releaseOf(release);

    if (!parsed) return [];

    return [
      {
        release,
        row: rows.get(release),
        tag: tagged.get(release),
        gh: released.get(release),
        npm: npmVersionOf(
          npm.has(parsed.name) ? npm.get(parsed.name) : undefined,
          parsed.version,
        ),
      },
    ];
  });
}

const CONFLICTS = ['tag_conflict', 'npm_conflict', 'gh_conflict'] as const;

function conflictFindings({ release, row }: Key): Finding[] {
  if (!row) return [];

  return CONFLICTS.flatMap((column) => {
    const conflict = row[column];

    return conflict === null
      ? []
      : [
          {
            release,
            level: 'action' as const,
            message: `the ledger records a ${column.replace('_conflict', '')} conflict: \`${conflict}\``,
          },
        ];
  });
}

/** `action` past the lag window, `info` within it. */
const lagging = (at: string, now: number): Finding['level'] => {
  const time = Date.parse(at);

  return Number.isNaN(time) || now - time > LAG_MS ? 'action' : 'info';
};

function tagFindings({ release, row, tag }: Key, now: number): Finding[] {
  const recorded = row?.git_sha ?? null;

  if (recorded !== null && !tag) {
    return [
      { release, level: 'action', message: 'the tag is gone from GitHub' },
    ];
  }

  if (recorded !== null && tag && tag.sha !== recorded) {
    return [
      {
        release,
        level: 'action',
        message: `the tag moved: the ledger has ${short(recorded)}, GitHub ${short(tag.sha)}`,
      },
    ];
  }

  if (recorded === null && tag) {
    return [
      {
        release,
        level: lagging(tag.at, now),
        message: 'the ledger has not recorded the tag',
      },
    ];
  }

  return [];
}

function npmFindings({ release, row, npm }: Key, now: number): Finding[] {
  if (npm === undefined) return [];

  const recorded = row?.npm_integrity ?? null;

  if (recorded !== null && npm === null) {
    return [
      { release, level: 'action', message: 'npm no longer has this version' },
    ];
  }

  if (npm === null) return [];

  if (recorded === null) {
    return [
      {
        release,
        level: lagging(npm.at, now),
        message: 'the ledger has not recorded the npm publish',
      },
    ];
  }

  if (npm.integrity !== recorded) {
    return [
      {
        release,
        level: 'action',
        message: "npm's integrity differs from the ledger's",
      },
    ];
  }

  if (npm.deprecated !== (row?.npm_deprecated ?? null)) {
    return [
      {
        release,
        level: 'info',
        message:
          npm.deprecated === null
            ? 'npm no longer marks this version deprecated'
            : `npm marks this version deprecated: ${npm.deprecated}`,
      },
    ];
  }

  return [];
}

function ghFindings({ release, row, gh }: Key, now: number): Finding[] {
  const recorded = row?.gh_release_id ?? null;

  if (recorded === null) {
    return gh
      ? [
          {
            release,
            level: lagging(gh.publishedAt, now),
            message: 'the ledger has not recorded the GitHub release',
          },
        ]
      : [];
  }

  if (!gh)
    return [
      { release, level: 'action', message: 'the GitHub release is gone' },
    ];

  if (gh.id !== recorded || gh.url !== row?.gh_url) {
    return [
      { release, level: 'action', message: 'the GitHub release was replaced' },
    ];
  }

  const findings: Finding[] = [];

  if (Number(gh.prerelease) !== row.gh_prerelease) {
    findings.push({
      release,
      level: 'action',
      message: "the release's prerelease flag changed",
    });
  }

  if ((gh.body ?? '') !== row.gh_body) {
    findings.push({
      release,
      level: 'action',
      message: "the release's notes were edited on GitHub",
    });
  }

  return findings;
}

/** #1430's pipeline order, as lag: tag, then npm, then the final release. */
function pipelineFindings(
  { release, row, tag, gh, npm }: Key,
  now: number,
): Finding[] {
  const npmAt = npm ? npm.at : (row?.npm_published_at ?? null);
  const tagged = tag !== undefined || (row?.git_sha ?? null) !== null;

  if (!tagged && (npmAt !== null || gh)) {
    return [{ release, level: 'action', message: 'published without a tag' }];
  }

  const lag = pipelineLag(tag, npmAt, gh);

  return lag
    ? [{ release, level: lagging(lag.at, now), message: lag.message }]
    : [];
}

/** The step a version is missing, and since when. */
function pipelineLag(
  tag: GitTag | undefined,
  npmAt: string | null,
  gh: GitHubRelease | undefined,
): { at: string; message: string } | undefined {
  if (gh) {
    return npmAt === null
      ? { at: gh.publishedAt, message: 'a final GitHub release ahead of npm' }
      : undefined;
  }

  if (npmAt !== null) {
    return { at: npmAt, message: 'on npm without a final GitHub release' };
  }

  return tag
    ? {
        at: tag.at,
        message: 'tagged, but not on npm: a publish run stopped before npm',
      }
    : undefined;
}

/** A dist-tag the ledger and npm disagree on; npm tags on versions the ledger never saw are out of scope. */
function distTagFindings(
  name: string,
  { ledger, npm, now }: Inputs,
  known: ReadonlySet<string>,
): Finding[] {
  const packument = npm.get(name);

  if (!packument) return [];

  const recorded = new Map(
    ledger.distTags
      .filter((row) => row.name === name)
      .map((row) => [row.tag, row.version]),
  );

  const live = packument['dist-tags'];
  const tags = new Set([...recorded.keys(), ...Object.keys(live)]);

  return [...tags].sort().flatMap((tag): Finding[] => {
    const ours = recorded.get(tag);
    const theirs = live[tag];

    if (
      ours === theirs ||
      (ours === undefined && !known.has(`${name}@${theirs}`))
    ) {
      return [];
    }

    // an unknown time reads as past the lag window
    const at = theirs === undefined ? '' : (packument.time[theirs] ?? '');

    return [
      {
        release: name,
        level: lagging(at, now),
        message: `dist-tag \`${tag}\`: the ledger has ${ours ?? 'none'}, npm ${theirs ?? 'none'}`,
      },
    ];
  });
}

/** Every finding, `action` first. */
export function reconcile(inputs: Inputs): Finding[] {
  const keys = keysOf(inputs);
  const known = new Set(keys.map(({ release }) => release));
  const names = packagesOf(inputs.ledger, inputs.tags, inputs.releases);

  const findings = [
    ...keys.flatMap((key) => [
      ...conflictFindings(key),
      ...tagFindings(key, inputs.now),
      ...npmFindings(key, inputs.now),
      ...ghFindings(key, inputs.now),
      ...pipelineFindings(key, inputs.now),
    ]),
    ...names.flatMap((name) => distTagFindings(name, inputs, known)),
  ];

  return [
    ...findings.filter(({ level }) => level === 'action'),
    ...findings.filter(({ level }) => level === 'info'),
  ];
}

/** The digest check for one new release: its `.tgz` asset against npm's tarball. */
export function digestFinding(
  release: string,
  asset: { digest: string | null } | undefined,
  npmSha256: string | undefined,
): Finding {
  if (npmSha256 === undefined) {
    return {
      release,
      level: 'info',
      message: 'tarball digest not compared: the version is not on npm',
    };
  }

  if (!asset) {
    return {
      release,
      level: 'action',
      message: 'the GitHub release has no `.tgz` asset',
    };
  }

  if (asset.digest !== `sha256:${npmSha256}`) {
    return {
      release,
      level: 'action',
      message: `the release's tarball digest ${asset.digest ?? 'none'} is not npm's sha256:${npmSha256}`,
    };
  }

  return {
    release,
    level: 'info',
    message: "the release's tarball matches npm's",
  };
}

const lines = (findings: readonly Finding[]): string[] =>
  findings.map(({ release, message }) => `- \`${release}\`: ${message}`);

const section = (heading: string, findings: readonly Finding[]): string[] =>
  findings.length === 0 ? [] : ['', `**${heading}**`, '', ...lines(findings)];

/** The findings and unreachable sources as the check run. */
export function toLedgerCheckRun(
  findings: readonly Finding[],
  unreachable: readonly string[],
): CheckRunPayload {
  const name = LEDGER_CHECK_RUN_NAME;
  const actions = findings.filter(({ level }) => level === 'action');
  const infos = findings.filter(({ level }) => level === 'info');
  const sources = unreachable.map((reason) => `- ${reason}`);

  const blocks = [
    ...section('Disagreements', actions),
    ...(sources.length === 0 ? [] : ['', '**Unreachable**', '', ...sources]),
    ...section('Notes', infos),
  ];

  if (actions.length > 0) {
    return {
      name,
      conclusion: 'action_required',
      title: `${actions.length} disagreement(s) between the ledger and GitHub or npm`,
      summary: [
        'The release ledger disagrees with GitHub or npm. This check only reports:',
        "find the cause, then re-observe with the ledger's `enqueue` script, or",
        'adopt the source with a maintainer `repair` (#1431).',
        ...blocks,
      ].join('\n'),
    };
  }

  if (unreachable.length > 0) {
    return {
      name,
      conclusion: 'neutral',
      title: 'could not verify: a source was unreachable',
      summary: [
        'A source could not be read, which says nothing about drift, so this',
        'renders grey rather than sharing a colour with a disagreement.',
        ...blocks,
      ].join('\n'),
    };
  }

  return {
    name,
    conclusion: 'success',
    title: 'the ledger agrees with GitHub and npm',
    summary: [
      'Every recorded release matches its tag, npm and GitHub release.',
      ...blocks,
    ].join('\n'),
  };
}
