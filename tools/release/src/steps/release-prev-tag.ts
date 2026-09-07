// The previous release tag of a package — the changelog range start the
// bump and publish drivers pin release-it to (#302) — or undefined on a
// first release, so publishing can never fail just because no earlier tag
// exists. `changelogFrom` is what the drivers call: the tag, or the repo
// root when the lane has none, so a first stable after an rc lane rolls up
// the package's whole history instead of the empty rc.N..HEAD range.
//
// This file is the IO shell: it runs `git describe` / `git rev-list` and
// delegates all decisions to the pure, unit-tested functions in
// ./release-prev-tag.core.ts. It was a CLI the workflow called; the drivers
// (release-bump.ts, release-publish.ts) now import it directly.

import type { Exec } from '@tools/shared/exec.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
  parseRootCommit,
  prereleaseChannel,
  prereleaseChannels,
  rootCommitArgs,
} from './release-prev-tag.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

/**
 * The conventional-changelog range start for a release: the package's
 * previous tag in this lane, else the repo's root commit.
 */
export async function changelogFrom(
  packageName: string,
  releaseVersion: string,
  options: { cwd?: string; exec?: Exec } = {},
): Promise<string> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;
  const tag = await prevReleaseTag(packageName, releaseVersion, { cwd, exec });
  if (tag !== undefined) return tag;
  const { stdout } = await exec('git', rootCommitArgs(), { cwd });
  return parseRootCommit(stdout);
}

/**
 * Same tolerance as the inline `… || true` this replaced: a first release
 * resolves undefined silently; a genuine git failure is surfaced on stderr
 * but still resolves undefined, so the publish proceeds without the range
 * override rather than dying here.
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
    const stderr =
      error !== null &&
      typeof error === 'object' &&
      'stderr' in error &&
      typeof error.stderr === 'string'
        ? error.stderr
        : '';
    if (!isFirstReleaseError(stderr)) {
      console.error(stderr === '' ? error : stderr);
    }
    return undefined;
  }
}
