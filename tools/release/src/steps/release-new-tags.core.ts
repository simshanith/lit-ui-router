// Pure logic for recovering the "which package released?" signal without a
// tag-push event: with tags pushed by GITHUB_TOKEN nothing is triggered, so
// the publish fan-out instead asks which workspace members' <name>@<version>
// release tags point at the commit this CI run validated. A tag that already
// existed at an older commit (unbumped package) doesn't point here; a tag
// rejected at a different commit doesn't either — only tags freshly created
// for THIS commit select a publish. The IO (git tag --points-at, loading the
// workspace) lives in release-new-tags.ts.

import type { Member } from '@tools/shared/workspace.ts';
import { releaseTagName } from './release-tag-push.core.ts';

/**
 * Names of publishable workspace members whose release tag is among
 * `tagsAtCommit`. Root and private members never publish; a member with no
 * version can't compose a tag and is skipped rather than thrown — detection
 * scans every member, unlike tag_push which targets one.
 */
export function newlyTaggedPackages(
  members: readonly Member[],
  tagsAtCommit: readonly string[],
): string[] {
  const tags = new Set(
    tagsAtCommit.map((tag) => tag.trim()).filter((tag) => tag !== ''),
  );
  return members
    .filter(
      (member) =>
        member.dir !== '<root>' &&
        member.manifest?.private !== true &&
        typeof member.manifest?.version === 'string' &&
        member.manifest.version.trim() !== '' &&
        tags.has(releaseTagName(member.name, member.manifest.version)),
    )
    .map((member) => member.name);
}
