// The git reads behind the Notes-Through staleness check, shared by its CLI
// (check-notes-through.ts) and the publish driver's backstop.
import { execFileSync } from 'node:child_process';

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

/**
 * Checks one package. `cwd` is its directory; `trailerRange` is the revision
 * range searched, newest first, for the commit that changed its CHANGELOG.md
 * and carries a `Notes-Through:` trailer; `tip` is the range end the notes
 * must cover. A commit in `<Notes-Through>..<tip>` the notes would list,
 * other than the trailer commit itself, makes it stale.
 */
export function checkNotesThrough(options: {
  packageName: string;
  cwd: string;
  trailerRange: string;
  tip: string;
}): NotesThroughResult {
  const { packageName, cwd, trailerRange, tip } = options;

  const trailer = logCommits(cwd, trailerRange, ['CHANGELOG.md']).flatMap(
    ({ hash, message }) => {
      const sha = parseNotesThrough(message);

      return sha === undefined ? [] : [{ hash, sha }];
    },
  )[0];

  if (trailer === undefined) {
    return {
      packageName,
      stale: [],
      problem: `no commit in ${trailerRange} that changed CHANGELOG.md carries a Notes-Through trailer`,
    };
  }

  const skip = createCatalogCommitSkip(cwd);
  let logged: LoggedCommit[];

  try {
    logged = logCommits(cwd, `${trailer.sha}..${tip}`, NOTES_PATHS);
  } catch (error) {
    return {
      packageName,
      trailerCommit: trailer.hash,
      notesThrough: trailer.sha,
      stale: [],
      problem: `cannot read ${trailer.sha}..${tip}: ${messageOf(error)}`,
    };
  }

  const stale: StaleCommit[] = logged.flatMap(({ hash, message }) =>
    hash !== trailer.hash &&
    isListedMessage(message, LISTED_TYPES) &&
    !skip({ hash })
      ? [{ hash, subject: message.split('\n', 1)[0] ?? '' }]
      : [],
  );

  return {
    packageName,
    trailerCommit: trailer.hash,
    notesThrough: trailer.sha,
    stale,
  };
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
