// The git reads behind the Notes-Through staleness check, shared by its CLI
// (check-notes-through.ts) and the publish driver's backstop.
import { execFileSync } from 'node:child_process';

import { findSection, notesThroughMarker } from '@tools/changelog';
import releaseItConfig from '@tools/release-config';
import { messageOf } from '@tools/shared/errors.ts';
import { createCatalogCommitSkip } from '@tools/release-config/catalog-commits.ts';

import {
  isListedMessage,
  type NotesThroughResult,
  parseNotesThrough,
  type StaleCommit,
} from './notes-through.core.ts';

const plugin = releaseItConfig.plugins['@release-it/conventional-changelog'];

/** The types the notes list, from the shared release-it config. */
export const LISTED_TYPES: ReadonlySet<string> = new Set(
  plugin.preset.types.map(({ type }) => type),
);

/** The notes' pathspec, relative to the package directory. */
export const NOTES_PATHS: readonly string[] = plugin.gitRawCommitsOpts.path;

interface LoggedCommit {
  hash: string;
  message: string;
}

function git(cwd: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Commits in `range` touching `paths`, newest first. */
function logCommits(
  cwd: string,
  range: string,
  paths: readonly string[],
): LoggedCommit[] {
  return git(cwd, ['log', '--format=%H%x00%B%x1e', range, '--', ...paths])
    .split('\x1e')
    .flatMap((record) => {
      const [hash = '', message = ''] = record.replace(/^\n/, '').split('\0');

      return hash === '' ? [] : [{ hash, message }];
    });
}

/** Where the notes' sha came from and the commit that put it there, or why neither was found. */
type NotesSource =
  | { source: 'marker' | 'trailer'; hash: string; sha: string }
  | { source: 'none'; problem: string };

/** `version`'s section in the package's CHANGELOG.md at `at`, or `undefined` when the file or section is missing. */
function sectionAt(cwd: string, at: string, version: string) {
  let text: string;

  try {
    text = git(cwd, ['show', `${at}:./CHANGELOG.md`]);
  } catch {
    // no CHANGELOG.md at `at`
    return undefined;
  }

  return findSection(text, version);
}

/** The newest commit in `range` that added or changed the marker line naming `sha`. */
function markerCommit(
  cwd: string,
  range: string,
  sha: string,
): string | undefined {
  const hash = git(cwd, [
    'log',
    '-1',
    '--format=%H',
    '-S',
    notesThroughMarker(sha),
    range,
    '--',
    'CHANGELOG.md',
  ]).trim();

  return hash === '' ? undefined : hash;
}

/** The newest commit in `range` that changed CHANGELOG.md and carries a `Notes-Through:` trailer. */
function trailerSource(cwd: string, range: string): NotesSource | undefined {
  return logCommits(cwd, range, ['CHANGELOG.md']).flatMap(
    ({ hash, message }): NotesSource[] => {
      const sha = parseNotesThrough(message);

      return sha === undefined ? [] : [{ source: 'trailer', hash, sha }];
    },
  )[0];
}

function notesSource(options: {
  cwd: string;
  version: string;
  at: string;
  trailerRange: string;
}): NotesSource {
  const { cwd, version, at, trailerRange } = options;
  const sha = sectionAt(cwd, at, version)?.notesThrough;

  if (sha === undefined) {
    return (
      trailerSource(cwd, trailerRange) ?? {
        source: 'none',
        problem: `CHANGELOG.md at ${at} has no ${version} section with a notes-through marker, and no commit in ${trailerRange} that changed it carries a Notes-Through trailer`,
      }
    );
  }

  const hash = markerCommit(cwd, `${sha}..${at}`, sha);

  return hash === undefined
    ? {
        source: 'none',
        problem: `no commit in ${sha}..${at} wrote the ${version} section's notes-through marker`,
      }
    : { source: 'marker', hash, sha };
}

/**
 * Checks one package's `version`. `cwd` is its directory. The sha the notes
 * were generated at comes from the marker opening the version's section in
 * CHANGELOG.md at `at`; a section without one falls back to the newest commit
 * in `trailerRange` that changed CHANGELOG.md and carries a `Notes-Through:`
 * trailer. `tip` is the range end the notes must cover. A commit in
 * `<sha>..<tip>` the notes would list, other than the one that wrote the
 * marker or carries the trailer, makes it stale.
 */
export function checkNotesThrough(options: {
  packageName: string;
  cwd: string;
  version: string;
  at: string;
  trailerRange: string;
  tip: string;
}): NotesThroughResult {
  const { packageName, cwd, tip } = options;
  const found = notesSource(options);

  if (found.source === 'none') {
    return { packageName, stale: [], problem: found.problem };
  }

  const { source, hash: notesCommit, sha: notesThrough } = found;
  const verdict = { packageName, source, notesCommit, notesThrough };
  const skip = createCatalogCommitSkip(cwd);
  let logged: LoggedCommit[];

  try {
    logged = logCommits(cwd, `${notesThrough}..${tip}`, NOTES_PATHS);
  } catch (error) {
    return {
      ...verdict,
      stale: [],
      problem: `cannot read ${notesThrough}..${tip}: ${messageOf(error)}`,
    };
  }

  const stale: StaleCommit[] = logged.flatMap(({ hash, message }) =>
    hash !== notesCommit &&
    isListedMessage(message, LISTED_TYPES) &&
    !skip({ hash })
      ? [{ hash, subject: message.split('\n', 1)[0] ?? '' }]
      : [],
  );

  return { ...verdict, stale };
}

function versionAt(root: string, rev: string, dir: string): string | undefined {
  try {
    // SAFETY: a package.json is a JSON object; a missing version reads as undefined
    const manifest = JSON.parse(
      git(root, ['show', `${rev}:${dir}/package.json`]),
    ) as { version?: string };

    return manifest.version;
  } catch {
    // the member does not exist at rev
    return undefined;
  }
}

/** The members of `dirs` whose package.json version `head` changes since its merge base with `base`. */
export function bumpedDirs(
  root: string,
  base: string,
  head: string,
  dirs: readonly string[],
): { dir: string; version: string }[] {
  const fork = git(root, ['merge-base', base, head]).trim();

  return dirs.flatMap((dir) => {
    const version = versionAt(root, head, dir);

    return version !== undefined && version !== versionAt(root, fork, dir)
      ? [{ dir, version }]
      : [];
  });
}
