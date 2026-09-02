// The previous release tag of a package — the changelog range start the
// publish driver pins release-it to (#302) — or undefined on a first
// release, so publishing can never fail just because no earlier tag exists.
//
// This file is the IO shell: it runs `git describe` and delegates all
// decisions to the pure, unit-tested functions in ./release-prev-tag.core.ts.
// It was a CLI the workflow called; the publish driver (release-publish.ts)
// now imports it directly.

import type { Exec } from '@tools/shared/exec.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
  prereleaseChannel,
  prereleaseChannels,
} from './release-prev-tag.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

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
