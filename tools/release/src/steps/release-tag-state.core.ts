// Pure logic for classifying a release tag before tagging or pushing it
// (#674): publish-gh runs on every main push and tags the CURRENT manifest
// version, so most runs meet a tag that already exists. The steps used to
// absorb that with continue-on-error, which also swallowed PAT, ruleset and
// network failures. Classifying here keeps the idempotent outcomes green and
// everything else fatal. The IO (git queries) lives in release-tag-state.ts.

/**
 * What a release tag already is, relative to the commit being released:
 *
 * - `tag` — no tag anywhere; the tag step creates it, the push step pushes it
 * - `skip-local` — the tag exists locally but not on the remote; nothing to
 *   create, still something to push
 * - `skip-remote-same` — the remote tag is on this commit: already released
 * - `skip-remote-diverged` — the remote tag is on a different commit. This is
 *   the steady state, not an anomaly: publish-gh runs on every main push and
 *   tags the CURRENT manifest version, so once main advances past a release
 *   commit the tag trails HEAD. Skipped like `skip-remote-same`, and just as
 *   quietly, or every main push would annotate a warning.
 */
export type TagState =
  | 'tag'
  | 'skip-local'
  | 'skip-remote-same'
  | 'skip-remote-diverged';

/** Whether the state means the release tag is already on the remote. */
export function isPushed(state: TagState): boolean {
  return state === 'skip-remote-same' || state === 'skip-remote-diverged';
}

/**
 * Classify from three peeled commit shas. The remote wins over the local tag:
 * a remote tag is the released fact, whatever a fetched local ref says.
 */
export function classifyTagState(shas: {
  localSha?: string | undefined;
  remoteSha?: string | undefined;
  headSha: string;
}): TagState {
  const { localSha, remoteSha, headSha } = shas;
  if (headSha.trim() === '') throw new Error('headSha must be non-empty');
  if (remoteSha !== undefined && remoteSha !== '') {
    return remoteSha === headSha ? 'skip-remote-same' : 'skip-remote-diverged';
  }
  if (localSha !== undefined && localSha !== '') return 'skip-local';
  return 'tag';
}

/** argv resolving the commit a local tag points at (annotated tags peel). */
export function localTagShaArgs(tagName: string): string[] {
  requireTagName(tagName);
  return ['rev-parse', '-q', '--verify', `refs/tags/${tagName}^{commit}`];
}

/** argv asking the remote whether the tag ref exists there. */
export function remoteTagShaArgs(tagName: string): string[] {
  requireTagName(tagName);
  return ['ls-remote', '--tags', 'origin', `refs/tags/${tagName}`];
}

/** argv resolving the commit being released. */
export function headShaArgs(): string[] {
  return ['rev-parse', 'HEAD'];
}

/**
 * The peeled commit from `git ls-remote` output, or undefined when the remote
 * has no such tag. An annotated tag prints two lines; the `^{}` one is the
 * commit, which is what a local `^{commit}` rev-parse yields.
 */
export function parseLsRemoteSha(stdout: string): string | undefined {
  let plain: string | undefined;
  for (const line of stdout.split('\n')) {
    const [sha = '', ref = ''] = line.trim().split(/\s+/);
    if (sha === '' || ref === '') continue;
    if (ref.endsWith('^{}')) return sha;
    plain ??= sha;
  }
  return plain;
}

/**
 * Whether a failed `git rev-parse -q --verify` just means "no such ref".
 * `-q` suppresses the message, so a silent failure is the missing ref and
 * anything with stderr (not a repository, bad object) stays fatal.
 */
export function isMissingRefError(stderr: string): boolean {
  return stderr.trim() === '';
}

/** The log line for a state, so the tag and push steps read the same. */
export function tagStateMessage(state: TagState, tagName: string): string {
  const messages: Record<TagState, string> = {
    tag: `no existing tag ${tagName}`,
    'skip-local': `tag ${tagName} already exists locally`,
    'skip-remote-same': `already released: ${tagName} is on the remote at this commit`,
    'skip-remote-diverged': `already released: ${tagName} is on the remote at a different commit (main has advanced past it)`,
  };
  return messages[state];
}

function requireTagName(tagName: string): void {
  if (tagName.trim() === '') throw new Error('tagName must be non-empty');
}
