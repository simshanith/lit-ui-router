// Pure logic for resolving WHICH package a publish run operates on —
// publish-npm.yml's "Extract package info from tag" + "Map npm name to
// directory" bash, minus the shell. The tag is the pipeline's taint source:
// anyone who can push a ref controls the string, and the old
// `TAG="${GITHUB_REF#refs/tags/}"; PACKAGE_NAME="${TAG%@*}"` lines flowed it
// through GITHUB_ENV into later shell lines. Here it stays an inert string
// (never re-parsed by any shell — see exec.ts) and MUST resolve to a
// workspace member before anything uses it. The IO (reading env, loading the
// workspace) lives in release-package-info.ts.

import type { Member } from '../lib/workspace.ts';

/**
 * The package name embedded in a release tag ref: everything before the LAST
 * `@` of the tag, exactly like bash `${TAG%@*}` (so scoped names survive:
 * `@scope/pkg@1.0.0` → `@scope/pkg`, and a leading `@` alone never splits).
 * A tag with no `@` passes through whole — also the bash behavior — and then
 * fails workspace-member resolution.
 */
export function packageFromRef(ref: string): string {
  const prefix = 'refs/tags/';
  if (!ref.startsWith(prefix)) {
    throw new Error(`GITHUB_REF ${JSON.stringify(ref)} is not a tag ref`);
  }
  const tag = ref.slice(prefix.length);
  if (tag === '') throw new Error('GITHUB_REF names an empty tag');
  const at = tag.lastIndexOf('@');
  return at <= 0 ? tag : tag.slice(0, at);
}

/**
 * Which package this run targets. Manual dispatch runs carry the required
 * `package` choice input (PACKAGE_INPUT); tag pushes don't, so the name comes
 * from the ref. Same observable branch as the old `github.event_name` check:
 * the input is `required: true` on dispatch and absent on push.
 */
export function resolvePackageName(options: {
  packageInput: string | undefined;
  ref: string | undefined;
}): string {
  const { packageInput, ref } = options;
  const input = packageInput?.trim() ?? '';
  if (input !== '') return input;
  if (ref === undefined || ref.trim() === '') {
    throw new Error('neither PACKAGE_INPUT nor GITHUB_REF is set');
  }
  return packageFromRef(ref.trim());
}

/**
 * The workspace-relative directory of the member named `name`. This lookup
 * is the backstop for hostile refnames: a tag like `$(touch pwned)@1.0.0`
 * yields a "package" no workspace member matches, so the run dies here with
 * the name safely JSON-quoted.
 */
export function memberDir(name: string, members: readonly Member[]): string {
  const member = members.find(
    (candidate) => candidate.name === name && candidate.dir !== '<root>',
  );
  if (member === undefined) {
    throw new Error(
      `package ${JSON.stringify(name)} is not a workspace member`,
    );
  }
  return member.dir;
}
