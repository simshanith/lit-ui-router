// package.json's `packageManager` is the pnpm authority; the mise config and
// the mise lockfile restate the same version with nothing else checking them
// against it. Assert they agree.
//
// pnpm never swaps to `packageManager` (`pmOnFail: ignore`), so pnpm-lock.yaml
// records no pnpm version: it stays one document, which is what GitHub's
// dependency graph and pnpm's prune settings read.
//
// The Workers Builds bootstrap is deliberately not a third pin: it derives the
// version from `packageManager` rather than restating it, so there is nothing
// here to compare (tools/workers-builds/cloudflare-build.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { taploGet } from './cli-query.ts';

// `pnpm@<version>+sha512.<hash>` — the integrity hash rides along, the version
// ahead of it is what the other files have to match.
const packageManager = requireManifest(workspaceRoot).packageManager ?? '';
const pinned = /^pnpm@([^+]+)\+sha512\./.exec(packageManager)?.[1];

// The mise files are TOML, so query them instead of matching their text (see
// cli-query.ts). `aqua:pnpm/pnpm` needs quoting — it carries a `:` and a `/`.
const MISE_TOOL = 'tools."aqua:pnpm/pnpm"';

// One locked tool: the requested version, plus a per-platform table each of
// whose download URLs carries that version in its path.
type LockedTool = {
  version: string;
  [platform: string]: unknown;
};

describe('pnpm version pins', () => {
  it('reads a version out of package.json packageManager', () => {
    assert.ok(pinned, `unparseable packageManager: ${packageManager}`);
  });

  it('.config/mise/config.toml requests it', () => {
    assert.equal(taploGet('.config/mise/config.toml', MISE_TOOL), pinned);
  });

  it('.config/mise/mise.lock locks it, on every platform it covers', () => {
    const [tool, ...extra] = taploGet(
      '.config/mise/mise.lock',
      MISE_TOOL,
    ) as LockedTool[];
    assert.equal(extra.length, 0, 'pnpm is locked more than once');
    assert.ok(tool, 'pnpm is not in the lockfile');
    assert.equal(tool.version, pinned);

    // Every platform mise did lock has to point at the same release. Which
    // platforms belong here is `mise lock`'s business, not this test's: pnpm
    // publishes no macos-x64 asset, so it locks six where every other tool
    // gets seven.
    const platforms = Object.entries(tool).filter(([key]) =>
      key.startsWith('platforms.'),
    ) as [string, { url: string }][];
    assert.notEqual(platforms.length, 0, 'pnpm is locked for no platform');
    for (const [platform, { url }] of platforms) {
      assert.match(url, new RegExp(`/v${pinned}/`), `${platform} url: ${url}`);
    }
  });

  // Read as text: node has no YAML parser that does not cost an install, and a
  // document separator is a line of its own.
  it('pnpm-lock.yaml is a single document', () => {
    const lock = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
    assert.match(
      lock,
      /^lockfileVersion: /,
      'starts with a document ahead of the lockfile',
    );
    assert.doesNotMatch(lock, /^---$/m, 'holds more than one YAML document');
  });
});
