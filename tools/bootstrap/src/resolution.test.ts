// The zero-dependency invariant, run rather than read. `.oxlintrc.json` bans a
// bare or escaping specifier in this package, but oxlint's no-restricted-imports
// only sees a string literal: `import(spec)` and `` import(`${x}`) `` pass it.
// Loading the package outside the repo, where no node_modules sits on any
// parent, catches every form — the specifier has to resolve or the process
// exits non-zero.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const here = new URL('.', import.meta.url);

describe('@tools/bootstrap resolution', () => {
  it('loads with no node_modules on any parent', async () => {
    const sources = (await readdir(here)).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    // A package whose whole point is being importable before an install cannot
    // prove that from an empty directory.
    assert.ok(sources.length > 0);

    const dir = await mkdtemp(join(tmpdir(), 'bootstrap-resolution-'));
    try {
      for (const name of sources) {
        await copyFile(fileURLToPath(new URL(name, here)), join(dir, name));
      }
      // Every entrypoint, not just the one with consumers today: an unreachable
      // module is exactly where an unresolvable import hides.
      const loader = sources
        .map((name) => `await import(${JSON.stringify(`./${name}`)});`)
        .join('\n');
      await writeFile(join(dir, 'load.mjs'), `${loader}\n`);

      await promisify(execFile)(process.execPath, [join(dir, 'load.mjs')], {
        cwd: dir,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
