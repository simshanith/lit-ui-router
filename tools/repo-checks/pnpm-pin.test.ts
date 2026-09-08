// package.json's `packageManager` is the pnpm authority, but four other files
// pin the same version and nothing else checks them against it. The bootstrap
// pin in cloudflare-build.sh is the one that hides: pnpm self-swaps to
// `packageManager`, so a stale bootstrap still deploys green (missed on #761,
// caught only by hand). Assert all five agree.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { requireManifest } from '@tools/shared/manifest.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

const read = (path: string) => readFileSync(join(workspaceRoot, path), 'utf8');

// `pnpm@<version>+sha512.<hash>` — the integrity hash rides along, the
// version ahead of it is the pin every other file has to match.
const packageManager = requireManifest(workspaceRoot).packageManager ?? '';
const pinned = /^pnpm@([^+]+)\+sha512\./.exec(packageManager)?.[1];

// Each entry names a file and every pnpm version in it, so a failure reads as
// the file to edit. `from`/`until` bound the scan where a bare pattern would
// also match unrelated versions.
const sources = [
  {
    file: '.config/mise/config.toml',
    // the aqua bootstrap tool pin
    pattern: /^"aqua:pnpm\/pnpm" = "(.+)"$/gm,
  },
  {
    file: '.config/mise/mise.lock',
    // the tool version, then the six per-platform download URLs
    pattern: /^version = "(.+)"$|pnpm\/pnpm\/releases\/download\/v([^/]+)\//gm,
    from: /^\[\[tools\."aqua:pnpm\/pnpm"\]\]$/,
    until: /^\[\[?tools\."(?!aqua:pnpm\/pnpm")/,
  },
  {
    file: 'pnpm-lock.yaml',
    // packageManagerDependencies.pnpm: both `specifier` and `version`
    pattern: /^\s+(?:specifier|version): (.+)$/gm,
    from: /^ {6}pnpm:$/,
    until: /^ {0,6}\S/,
  },
  {
    file: 'tools/workers-builds/cloudflare-build.sh',
    // the `npm install --global` bootstrap line
    pattern: /pnpm@(\S+)/g,
  },
];

const scope = (content: string, from?: RegExp, until?: RegExp) => {
  if (!from) return content;
  const lines = content.split('\n');
  const start = lines.findIndex((line) => from.test(line));
  assert.notEqual(start, -1, `no line matched ${from}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => until?.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
};

describe('pnpm version pins', () => {
  it('reads a version out of package.json packageManager', () => {
    assert.ok(pinned, `unparseable packageManager: ${packageManager}`);
  });

  for (const { file, pattern, from, until } of sources) {
    it(`${file} pins ${pinned}`, () => {
      const found = [...scope(read(file), from, until).matchAll(pattern)]
        .map((groups) => groups.slice(1).find((group) => group !== undefined))
        .filter((version) => version !== undefined);
      assert.notEqual(found.length, 0, `no pnpm version found in ${file}`);
      for (const version of found) {
        assert.equal(
          version,
          pinned,
          `${file} pins pnpm ${version}, package.json pins ${pinned}`,
        );
      }
    });
  }
});
