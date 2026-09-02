// IO shell for the tag classification the Tag and Push tag steps share
// (#674): git queries in, shas to the pure classifier in
// ./release-tag-state.core.ts. Only a missing local ref is tolerated.

import type { Exec } from '@tools/shared/exec.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';
import { memberDir } from './release-package-info.core.ts';
import { releaseTagName } from './release-tag-push.core.ts';
import type { TagState } from './release-tag-state.core.ts';
import {
  classifyTagState,
  headShaArgs,
  isMissingRefError,
  localTagShaArgs,
  parseLsRemoteSha,
  remoteTagShaArgs,
} from './release-tag-state.core.ts';

export type TagOptions = { cwd?: string; exec?: Exec };

/** `<package>@<version>` for a workspace member, from its manifest version. */
export async function resolveReleaseTagName(
  packageName: string,
): Promise<string> {
  const { members } = await loadWorkspace(workspaceRoot);
  // memberDir doubles as membership validation before composing a ref.
  memberDir(packageName, members);
  const version =
    members.find((member) => member.name === packageName)?.manifest?.version ??
    '';
  return releaseTagName(packageName, version);
}

/** The commit a local tag points at, or undefined when there is no such tag. */
export async function localTagSha(
  tagName: string,
  options: TagOptions = {},
): Promise<string | undefined> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;
  try {
    const { stdout } = await exec('git', localTagShaArgs(tagName), { cwd });
    const sha = stdout.trim();
    return sha === '' ? undefined : sha;
  } catch (error) {
    if (isMissingRefError(stderrOf(error))) return undefined;
    throw error;
  }
}

/** The commit the remote's tag points at; a failed query is fatal, not absent. */
export async function remoteTagSha(
  tagName: string,
  options: TagOptions = {},
): Promise<string | undefined> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;
  const { stdout } = await exec('git', remoteTagShaArgs(tagName), { cwd });
  return parseLsRemoteSha(stdout);
}

/** The commit being released. */
export async function headSha(options: TagOptions = {}): Promise<string> {
  const { cwd = workspaceRoot, exec = defaultExec } = options;
  const { stdout } = await exec('git', headShaArgs(), { cwd });
  return stdout.trim();
}

/** What already exists for this tag, local and remote. */
export async function resolveTagState(
  tagName: string,
  options: TagOptions = {},
): Promise<TagState> {
  const [local, remote, head] = await Promise.all([
    localTagSha(tagName, options),
    remoteTagSha(tagName, options),
    headSha(options),
  ]);
  return classifyTagState({
    localSha: local,
    remoteSha: remote,
    headSha: head,
  });
}

function stderrOf(error: unknown): string {
  return error !== null &&
    typeof error === 'object' &&
    'stderr' in error &&
    typeof error.stderr === 'string'
    ? error.stderr
    : 'unknown git failure';
}
