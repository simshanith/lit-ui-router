// The patch the release diff store keeps against the real `npm diff`, byte for byte; it reads the npm registry, so it runs as `acceptance (npm-diff)`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { indexPatch } from '../diff-index.ts';
import { buildPatch, sectionsOf } from '../store.ts';

const run = promisify(execFile);

/** Changed files only, files added, and files removed (the added pair reversed). */
const PAIRS = [
  ['lit-ui-router', '1.16.4', '1.16.5'],
  ['ui-router-server', '0.2.2', '0.3.0'],
  ['ui-router-server', '0.3.0', '0.2.2'],
] as const;

/** `npm diff`'s stdout, its defaults pinned against any user config. */
const npm = async (name: string, from: string, to: string): Promise<string> => {
  const { stdout } = await run(
    'npm',
    [
      'diff',
      `--diff=${name}@${from}`,
      `--diff=${name}@${to}`,
      '--color=false',
      '--tag-version-prefix=v',
      '--diff-unified=3',
    ],
    { cwd: tmpdir(), maxBuffer: 64 * 1024 * 1024 },
  );

  return stdout;
};

describe('npm diff parity', () => {
  for (const [name, from, to] of PAIRS) {
    it(`matches npm diff for ${name}@${from}...${to}`, async () => {
      const [patch, theirs] = await Promise.all([
        buildPatch({ name, from, to }),
        npm(name, from, to),
      ]);

      assert.ok(theirs.length > 0, 'npm diff printed nothing');
      assert.deepEqual(patch, new TextEncoder().encode(theirs));

      // The All preset's sections, joined by their index entries, rebuild the patch.
      assert.deepEqual(sectionsOf(patch, indexPatch(patch), 'all'), patch);
    });
  }
});
