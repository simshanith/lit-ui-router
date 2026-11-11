import { RELEASES_MOUNT } from '../worker/releases/routes.ts';

/** The worker-rendered releases index. */
export const RELEASES_PATH = `${RELEASES_MOUNT}/`;

/** Source directory of the generated stubs; gitignored, and excluded from the llms outputs and the sitemap. */
export const STUB_DIR = 'package-releases';

export interface ReleaseStub {
  /** Path relative to the docs source root. */
  file: string;
  markdown: string;
}

/** The worker's page for one package. */
export const releasesPath = (name: string): string =>
  `${RELEASES_PATH}${encodeURIComponent(name)}/`;

/** A page local search indexes for `name`, pointing at the releases page the worker renders. */
export function releaseStub(name: string): ReleaseStub {
  const description = `Every released version of ${name}, with release notes and version diffs.`;

  return {
    file: `${STUB_DIR}/${name}.md`,
    markdown: `---
title: ${name} releases
description: ${description}
head:
  - - meta
    - name: robots
      content: noindex
---

# ${name} releases

Every released version of \`${name}\`, newest first, with links to its release notes and version-to-version diffs, is on the [${name} releases page](${releasesPath(name)}){target="_self"}.
`,
  };
}

/** One stub per published package: private manifests ship nothing to npm. */
export function releaseStubs(
  manifests: readonly { name?: string; private?: boolean }[],
): ReleaseStub[] {
  return manifests
    .flatMap(({ name, private: isPrivate }) =>
      name && !isPrivate ? [name] : [],
    )
    .sort()
    .map(releaseStub);
}
