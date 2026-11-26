import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { README_SOURCED } from '../../catalog/packages.ts';

const SITE = join(import.meta.dirname, '../..');

const PACKAGES_DIR = join(workspaceRoot, 'packages');

/** The directory under packages/ that publishes a name; it is not always the name. */
const packageDir = (name: string): string => {
  const dir = readdirSync(PACKAGES_DIR).find(
    (entry) => readManifest(join(PACKAGES_DIR, entry))?.name === name,
  );

  assert.ok(dir, `${name}: no package publishes it`);

  return dir;
};

const MARKER = /^<!-- #(region|endregion) (\S+) -->$/;

/** A README's regions in order, and its lines that sit in none. */
function regions(readme: string) {
  const names: string[] = [];
  const outside: string[] = [];
  let open: string | undefined;

  for (const line of readme.split('\n')) {
    const [, kind, name] = MARKER.exec(line) ?? [];

    if (kind === 'region' && name) {
      assert.equal(open, undefined, `#region ${name} opens inside ${open}`);
      open = name;
      names.push(name);
    } else if (kind === 'endregion') {
      assert.equal(name, open, `#endregion ${name} closes ${open}`);
      open = undefined;
    } else if (!open && line.trim()) outside.push(line);
  }

  assert.equal(open, undefined, `#region ${open} never closes`);

  return { names, outside };
}

describe('README-sourced package pages', () => {
  for (const name of README_SOURCED) {
    const dir = packageDir(name);
    const readme = readFileSync(join(PACKAGES_DIR, dir, 'README.md'), 'utf8');
    const page = readFileSync(join(SITE, 'packages', `${name}.md`), 'utf8');
    const { names, outside } = regions(readme);

    it(`${name}: the README is its title and named regions`, () => {
      assert.ok(names.length > 0, 'no regions');
      assert.equal(new Set(names).size, names.length, 'a region name repeats');
      assert.deepEqual(outside, [`# ${name}`]);
    });

    it(`${name}: the page includes every README region, in the README's order`, () => {
      const included = [
        ...page.matchAll(/^<!--@include: (\S+)#([^\s#]+)-->$/gm),
      ].flatMap(([, path, region]) =>
        path === `../../../packages/${dir}/README.md` ? [region] : [],
      );

      assert.deepEqual(included, names);
    });
  }
});
