// The previous release tag of a package — the changelog range start the
// bump and publish drivers pin release-it to (#302) — or undefined on a
// first release, so publishing can never fail just because no earlier tag
// exists. `changelogRange` is what the drivers call: the tag, or the repo
// root when the lane has none, so a first stable after an rc lane rolls up
// the package's whole history instead of the empty rc.N..HEAD range.
//
// This file is the IO shell: it runs `git describe` / `git rev-list` and
// delegates all decisions to the pure, unit-tested functions in
// ./release-prev-tag.core.ts. It was a CLI the workflow called; the drivers
// (release-bump.ts, release-publish.ts) now import it directly.

import type { Exec } from '@tools/shared/exec.ts';
import { defaultExec, readExecFailure } from '@tools/shared/exec.ts';
import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
  parseRootCommit,
  prereleaseChannel,
  prereleaseChannels,
  rootCommitArgs,
} from './release-prev-tag.core.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

/** A release's changelog range, and the version the notes compare against. */
export interface ChangelogRange {
  /** The range start: the previous tag in this lane, else the repo's root commit. */
  from: string;
  /** The previous tag's version; empty when the lane has none. */
  previousVersion: string;
}

export async function changelogRange(
  packageName: string,
  releaseVersion: string,
  options: { cwd?: string; exec?: Exec } = {},
): Promise<ChangelogRange> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;
  const tag = await prevReleaseTag(packageName, releaseVersion, { cwd, exec });

  if (tag !== undefined) {
    return { from: tag, previousVersion: tag.slice(packageName.length + 1) };
  }

  const { stdout } = await exec('git', rootCommitArgs(), { cwd });

  return { from: parseRootCommit(stdout), previousVersion: '' };
}

/**
 * A first release resolves undefined; a genuine git failure throws, since
 * `changelogRange` would otherwise read it as "no tag" and roll a routine
 * release's changelog up from the repo root.
 */
export async function prevReleaseTag(
  packageName: string,
  releaseVersion: string,
  options: { cwd?: string; exec?: Exec } = {},
): Promise<string | undefined> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;

  try {
    // the other channels this package has tagged, so a prerelease's describe
    // walk can exclude their lanes (a stable excludes all of them by glob)
    const channel = prereleaseChannel(releaseVersion);

    const { stdout: tagList } = await exec(
      'git',
      ['tag', '-l', `${packageName}@*`],
      { cwd },
    );

    const otherChannels = prereleaseChannels(packageName, tagList).filter(
      (c) => c !== channel,
    );

    const { stdout } = await exec(
      'git',
      describeArgs(packageName, releaseVersion, otherChannels),
      { cwd },
    );

    return parsePrevTag(stdout);
  } catch (error) {
    const stderr = readExecFailure(error).stderr ?? '';

    if (!isFirstReleaseError(stderr)) throw error;

    return undefined;
  }
}
