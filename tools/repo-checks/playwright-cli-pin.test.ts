// Each @playwright/cli release pins an exact Playwright prerelease, and the
// workspace overrides swap in the catalog's Playwright instead. That holds only
// while both are the same minor, so a Playwright bump has to move the CLI to
// the release built against it (Dependabot ignores the CLI for this reason).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

/** As much of pnpm-lock.yaml as this check reads. */
type Lock = {
  catalogs: { default: Record<string, { version: string }> };
};

const minor = (version: string): string | undefined =>
  /^(\d+\.\d+)\./.exec(version)?.[1];

// SAFETY: pnpm writes every catalog entry it resolves under catalogs.default
const lock = parse(
  readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8'),
) as Lock;

const cli = requireManifest(
  join(workspaceRoot, 'node_modules', '@playwright', 'cli'),
);

describe('@playwright/cli pin', () => {
  it('is built against the catalog Playwright minor', () => {
    const catalog = lock.catalogs.default.playwright?.version;
    const built = cli.dependencies?.playwright;

    assert.ok(catalog, 'playwright is not in the default catalog');
    assert.ok(built, '@playwright/cli no longer depends on playwright');
    assert.equal(
      minor(built),
      minor(catalog),
      `@playwright/cli@${cli.version} is built against playwright ${built}, the catalog resolves ${catalog}: move @playwright/cli to the release built against ${minor(catalog)}`,
    );
  });
});
