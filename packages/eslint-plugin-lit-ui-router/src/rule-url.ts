/**
 * Documentation urls for the rules, pinned to the version that reports them.
 */

import packageJson from '../package.json' with { type: 'json' };
import type { RuleName } from './rules.ts';

const REPO = 'https://github.com/simshanith/lit-ui-router';

// The rule docs ship in the tarball, so a `blob/main` url would answer a problem
// reported by an installed version with whatever main says today. Releases tag
// each package as `<name>@<version>`, so the version here names a tag: between
// releases it is the last one tagged, and a bump commit is tagged as it ships.
const TAG = `${packageJson.name}@${packageJson.version}`;
const RULE_DOCS = `${REPO}/blob/${TAG}/${packageJson.repository.directory}/docs/rules`;

/** Canonical url for one rule's documentation. */
export function ruleUrl(rule: RuleName): string {
  return `${RULE_DOCS}/${rule}.md`;
}
