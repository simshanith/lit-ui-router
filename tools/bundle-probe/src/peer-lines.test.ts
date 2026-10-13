// Peer lines are read off the install, so the fixture is a package dir with a
// hand-written node_modules: a registry install, a compat alias of it, and a
// workspace link.
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { bundleEntry, bundlers } from './bundle.ts';
import { readPeerLines } from './peer-lines.ts';

const write = (file: string, content: string): void => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const install = (
  dir: string,
  as: string,
  name: string,
  version: string,
  source: string,
): void => {
  const root = path.join(dir, 'node_modules', as);
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ name, version, type: 'module', main: 'index.js' }),
  );
  write(path.join(root, 'index.js'), source);
};

const fixture = (): string => {
  const parent = realpathSync(
    mkdtempSync(path.join(tmpdir(), 'bundle-probe-peers-')),
  );

  const dir = path.join(parent, 'pkg');

  write(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'probe-fixture',
      peerDependencies: { dep: '^1.0.0 || ^2.0.0', ws: '^1.0.0' },
      devDependencies: { 'dep-1': 'npm:dep@^1.0.0', ws: 'workspace:*' },
    }),
  );
  write(
    path.join(dir, 'src', 'index.ts'),
    "import * as dep from 'dep';\nexport const read = (): unknown => dep.added;\n",
  );
  install(
    dir,
    'dep',
    'dep',
    '2.0.0',
    'export const kept = 1;\nexport const added = 2;\n',
  );
  install(dir, 'dep-1', 'dep', '1.0.0', 'export const kept = 1;\n');

  const workspace = path.join(parent, 'ws');
  write(
    path.join(workspace, 'package.json'),
    JSON.stringify({ name: 'ws', version: '1.0.0' }),
  );
  symlinkSync(workspace, path.join(dir, 'node_modules', 'ws'));

  return dir;
};

describe('readPeerLines', () => {
  it('inlines registry installs and adds a line per peer alias', () => {
    assert.deepEqual(readPeerLines(fixture()), [
      { label: 'dep@2.0.0', inline: ['dep'], alias: {} },
      {
        label: 'dep@1.0.0 via dep-1',
        inline: ['dep'],
        alias: { dep: 'dep-1' },
      },
    ]);
  });
});

describe('bundleEntry alias', () => {
  for (const bundler of bundlers) {
    it(`${bundler} warns in the importer when the aliased line lacks an export`, async () => {
      const dir = fixture();
      const entry = path.join(dir, 'src', 'index.ts');

      const current = await bundleEntry(entry, bundler);

      const older = await bundleEntry(entry, bundler, {
        alias: { from: dir, packages: { dep: 'dep-1' } },
      });

      assert.deepEqual(current.warnings, []);
      assert.deepEqual(
        older.warnings.map(({ file, message }) => ({
          file,
          named: message.includes('added'),
        })),
        [{ file: entry, named: true }],
      );
    });
  }
});
