import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { binPath } from './execve.ts';
import oxlint from 'oxlint/package.json' with { type: 'json' };
import typescript from 'typescript/package.json' with { type: 'json' };

// This package's own devDependencies, imported the way callers do: statically,
// so the specifier stays visible to knip.
describe('binPath', () => {
  it('defaults the bin name to the package name', () => {
    const bin = binPath(oxlint, import.meta.resolve('oxlint/package.json'));
    assert.match(bin, /oxlint$/);
    assert.ok(existsSync(bin), `${bin} does not exist`);
  });

  it('takes a bin name that differs from the package', () => {
    const bin = binPath(
      typescript,
      import.meta.resolve('typescript/package.json'),
      'tsc',
    );
    // the manifest spells this one `./bin/tsc`, so the join has to normalize
    assert.match(bin, /[^.]\/bin\/tsc$/);
    assert.ok(existsSync(bin), `${bin} does not exist`);
  });

  it('names the package when the bin is not declared', () => {
    assert.throws(
      () => binPath(typescript, import.meta.resolve('typescript/package.json')),
      /typescript declares no typescript bin/,
    );
  });
});

describe('execve', () => {
  it('replaces the process: the exit code is the target’s, and nothing follows', () => {
    const module = JSON.stringify(new URL('./execve.ts', import.meta.url).href);
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const { execve } = await import(${module});
         execve('probe', process.execPath, [
           process.execPath, '-e', "process.stdout.write('became'); process.exit(7)",
         ]);
         process.stdout.write('unreachable');`,
      ],
      { encoding: 'utf8' },
    );

    assert.equal(child.status, 7);
    assert.equal(child.stdout, 'became');
  });
});
