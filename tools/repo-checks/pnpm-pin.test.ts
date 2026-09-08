// package.json's `packageManager` is the pnpm authority; the mise config, the
// mise lockfile and pnpm-lock.yaml restate the same version with nothing else
// checking them against it. Assert they agree.
//
// The Workers Builds bootstrap used to be a fourth pin here, and was the one
// that hid: pnpm self-swaps to `packageManager`, so a stale bootstrap still
// deploys green (missed on #761, caught by hand). It derives the version now
// instead of restating it, so there is nothing left to compare — see
// tools/workers-builds/cloudflare-build.ts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { requireManifest } from '@tools/shared/manifest.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

// `pnpm@<version>+sha512.<hash>` — the integrity hash rides along, the version
// ahead of it is what the other files have to match.
const packageManager = requireManifest(workspaceRoot).packageManager ?? '';
const pinned = /^pnpm@([^+]+)\+sha512\./.exec(packageManager)?.[1];

// The mise files are TOML, so query them instead of matching their text:
// taplo is already this repo's TOML linter and formatter, and its `get` takes
// a jq-like path. `aqua:pnpm/pnpm` needs quoting — it carries a `:` and a `/`.
const MISE_TOOL = 'tools."aqua:pnpm/pnpm"';
const taploGet = (file: string, pattern: string): unknown =>
  JSON.parse(
    execFileSync(
      'taplo',
      ['get', '-f', join(workspaceRoot, file), '-o', 'json', pattern],
      { encoding: 'utf8' },
    ),
  );

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

  // The one file read as text: pnpm-lock.yaml is YAML, and node has no parser
  // for it that does not cost an install. The block is four lines and pnpm
  // writes it, so scope the scan and match within it.
  it('pnpm-lock.yaml resolves it', () => {
    const lock = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
    const block = /^ {6}pnpm:$\n((?: {8}.*\n)+)/m.exec(lock)?.[1];
    assert.ok(block, 'no packageManagerDependencies.pnpm block');
    const found = [...block.matchAll(/^\s+(?:specifier|version): (.+)$/gm)].map(
      ([, version]) => version,
    );
    assert.deepEqual(found, [pinned, pinned]);
  });
});
