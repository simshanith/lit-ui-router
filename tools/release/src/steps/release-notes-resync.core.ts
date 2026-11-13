// The release-notes re-sync, file to GitHub: which published releases' bodies
// differ from their CHANGELOG.md section, and the gh calls that correct them.
// Only `gh release edit --notes-file --latest=<as-is>` ever writes.
import { parseChangelog } from '@tools/changelog';
import { sameNotes } from '@tools/changelog/drift.ts';
import { messageOf } from '@tools/shared/errors.ts';
import type { Exec } from '@tools/shared/exec.ts';
import { createTwoFilesPatch } from 'diff';
import semver from 'semver';
import * as v from 'valibot';

/** One release of the listing; the job's token sees no drafts, a maintainer's does. */
export const ReleaseSchema = v.object({
  tag: v.string(),
  draft: v.boolean(),
  prerelease: v.boolean(),
  body: v.nullable(v.string()),
});

export type Release = v.InferOutput<typeof ReleaseSchema>;

/** A published package and its CHANGELOG.md text, `undefined` when there is none. */
export interface PackageChangelog {
  readonly name: string;
  readonly text: string | undefined;
}

/** Empty selects every package, or every differing version. */
export interface Selection {
  readonly package: string;
  readonly version: string;
}

export interface Change {
  readonly tag: string;
  /** The section body, as the publish hands it to GitHub. */
  readonly notes: string;
  /** Unified diff from the GitHub body to the section. */
  readonly diff: string;
}

export interface Plan {
  readonly changes: readonly Change[];
  readonly skipped: readonly { tag: string; reason: string }[];
  readonly inSync: readonly string[];
}

/** The text a section publishes as, matching `@tools/changelog`'s extract. */
const notesOf = (body: string): string => (body === '' ? '' : `${body}\n`);

/** The unified diff from GitHub's body to the section's, trailing whitespace aside. */
export function notesDiff(
  tag: string,
  published: string,
  section: string,
): string {
  return createTwoFilesPatch(
    `${tag} (GitHub)`,
    `${tag} (CHANGELOG.md)`,
    notesOf(published.trimEnd()),
    notesOf(section.trimEnd()),
  );
}

const isStable = (version: string): boolean =>
  semver.valid(version) === version && semver.prerelease(version) === null;

function selectedFiles(
  files: readonly PackageChangelog[],
  selection: Selection,
): PackageChangelog[] {
  if (selection.package === '') return [...files];

  const file = files.find(({ name }) => name === selection.package);

  if (!file) throw new Error(`${selection.package} is not a published package`);

  return [file];
}

type Outcome =
  | { kind: 'change'; change: Change }
  | { kind: 'skip'; tag: string; reason: string }
  | { kind: 'in-sync'; tag: string };

function outcomeOf(
  tag: string,
  body: string,
  release: Release | undefined,
): Outcome {
  if (!release) {
    return { kind: 'skip', tag, reason: 'no GitHub release; never created' };
  }

  if (release.draft || release.prerelease) {
    return {
      kind: 'skip',
      tag,
      reason: `the release is a ${release.draft ? 'draft' : 'prerelease'}`,
    };
  }

  const published = release.body ?? '';

  return sameNotes(body, published)
    ? { kind: 'in-sync', tag }
    : {
        kind: 'change',
        change: {
          tag,
          notes: notesOf(body),
          diff: notesDiff(tag, published, body),
        },
      };
}

/** What a re-sync would edit; throws on a selection that names no package or section. */
export function planResync(
  files: readonly PackageChangelog[],
  releases: readonly Release[],
  selection: Selection,
): Plan {
  const byTag = new Map(releases.map((release) => [release.tag, release]));

  const outcomes = selectedFiles(files, selection).flatMap(({ name, text }) =>
    parseChangelog(text ?? '')
      .sections.filter(
        ({ version }) =>
          isStable(version) &&
          (selection.version === '' || version === selection.version),
      )
      .map(({ version, body }) =>
        outcomeOf(`${name}@${version}`, body, byTag.get(`${name}@${version}`)),
      ),
  );

  if (selection.version !== '' && outcomes.length === 0) {
    throw new Error(`no CHANGELOG.md section for version ${selection.version}`);
  }

  return {
    changes: outcomes.flatMap((o) => (o.kind === 'change' ? [o.change] : [])),
    skipped: outcomes.flatMap((o) =>
      o.kind === 'skip' ? [{ tag: o.tag, reason: o.reason }] : [],
    ),
    inSync: outcomes.flatMap((o) => (o.kind === 'in-sync' ? [o.tag] : [])),
  };
}

/** argv listing every release as JSON lines. */
export function releaseListArgs(repo: string): string[] {
  return [
    'api',
    '--paginate',
    `repos/${repo}/releases?per_page=100`,
    '--jq',
    '.[] | {tag: .tag_name, draft, prerelease, body}',
  ];
}

const LATEST_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) { latestRelease { tagName } }
}`;

/** argv printing the tag of the release marked Latest, or an empty line when none is. */
export function latestArgs(repo: string): string[] {
  const [owner = '', name = ''] = repo.split('/');

  return [
    'api',
    'graphql',
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${name}`,
    '-f',
    `query=${LATEST_QUERY}`,
    '--jq',
    '.data.repository.latestRelease.tagName // ""',
  ];
}

/**
 * argv replacing one release's notes. `--latest` is always explicit: the
 * update API documents make_latest as defaulting to true, and gh omits it
 * without the flag. No other field is sent; gh re-sends the release's own tag.
 */
export function editArgs(
  repo: string,
  tag: string,
  notesFile: string,
  latest: boolean,
): string[] {
  return [
    'release',
    'edit',
    tag,
    '--repo',
    repo,
    '--notes-file',
    notesFile,
    `--latest=${latest}`,
  ];
}

/** argv marking `tag` Latest again. */
export function restoreLatestArgs(repo: string, tag: string): string[] {
  return ['release', 'edit', tag, '--repo', repo, '--latest'];
}

export async function readLatest(
  exec: Exec,
  repo: string,
): Promise<string | undefined> {
  const { stdout } = await exec('gh', latestArgs(repo));
  const tag = stdout.trim();

  return tag === '' ? undefined : tag;
}

export interface ApplyContext {
  readonly exec: Exec;
  readonly repo: string;
  /** The Latest tag before any edit. */
  readonly latest: string | undefined;
  /** Writes `notes` to a file and returns its path. */
  readonly writeNotes: (tag: string, notes: string) => Promise<string>;
}

/** The tags edited, and why the run stopped early, if it did. */
export interface Applied {
  readonly edited: readonly string[];
  readonly failure: string | undefined;
}

/**
 * Edits each change's notes in order, checking after every edit that the
 * Latest marker stayed put. A moved marker is put back and stops the run, as
 * does any failed call.
 */
export async function applyResync(
  changes: readonly Change[],
  { exec, repo, latest, writeNotes }: ApplyContext,
): Promise<Applied> {
  const edited: string[] = [];

  try {
    for (const { tag, notes } of changes) {
      const file = await writeNotes(tag, notes);
      await exec('gh', editArgs(repo, tag, file, tag === latest));
      edited.push(tag);

      const now = await readLatest(exec, repo);

      if (now === latest) continue;

      if (latest !== undefined)
        await exec('gh', restoreLatestArgs(repo, latest));

      return {
        edited,
        failure: `editing ${tag} moved Latest from ${latest ?? 'none'} to ${now ?? 'none'}; restored it and stopped`,
      };
    }
  } catch (cause) {
    return { edited, failure: messageOf(cause) };
  }

  return { edited, failure: undefined };
}

/** The job summary: what changed, or would change, with each diff. */
export function resyncMarkdown(
  plan: Plan,
  latest: string | undefined,
  applied: Applied | undefined,
): string {
  const edited = new Set(applied?.edited ?? []);

  const changes = plan.changes.flatMap(({ tag, diff }) => [
    `<details><summary><code>${tag}</code>${applied && !edited.has(tag) ? ' (not edited)' : ''}</summary>`,
    '',
    '```diff',
    diff.trimEnd(),
    '```',
    '',
    '</details>',
    '',
  ]);

  const skipped = plan.skipped.map(
    ({ tag, reason }) => `- \`${tag}\`: ${reason}`,
  );

  const verdict = applied
    ? `Edited ${edited.size} of ${plan.changes.length} differing release(s)`
    : `Would edit ${plan.changes.length} release(s)`;

  return [
    `## Release notes re-sync${applied ? '' : ' (dry run)'}`,
    '',
    `${verdict}; ${plan.inSync.length} already match; Latest stays \`${latest ?? 'none'}\`.`,
    ...(applied?.failure === undefined
      ? []
      : ['', `**Stopped:** ${applied.failure}`]),
    '',
    ...changes,
    ...(skipped.length === 0 ? [] : ['**Skipped**', '', ...skipped, '']),
  ].join('\n');
}
