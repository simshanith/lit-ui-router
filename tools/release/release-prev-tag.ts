// The previous release tag of a package — the changelog range start the
// publish driver pins release-it to (#302) — or undefined on a first
// release, so publishing can never fail just because no earlier tag exists.
//
// This file is the IO shell: it runs `git describe` and delegates all
// decisions to the pure, unit-tested functions in ./release-prev-tag.core.ts.
// It was a CLI the workflow called; the publish driver (release-publish.ts)
// now imports it directly.

import type { Exec } from './exec.ts';
import { defaultExec } from './exec.ts';
import {
  describeArgs,
  isFirstReleaseError,
  parsePrevTag,
} from './release-prev-tag.core.ts';
import { workspaceRoot } from './workspace.ts';

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
    const { stdout } = await exec(
      'git',
      describeArgs(packageName, releaseVersion),
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
