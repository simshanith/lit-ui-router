// The in-house npm diff against the real `npm diff`, byte for byte; it reads the npm registry, so it runs as `acceptance (npm-diff)`.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

import { npmDiff } from '../../releases/npm-diff/registry.ts';

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
      const [ours, theirs] = await Promise.all([
        npmDiff(name, from, to),
        npm(name, from, to),
      ]);

      assert.ok(theirs.length > 0, 'npm diff printed nothing');
      // npm prints the patch with a trailing newline.
      assert.equal(`${ours}\n`, theirs);
    });
  }
});
