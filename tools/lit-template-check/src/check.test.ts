import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { describe, it } from 'node:test';

import { API } from 'typescript-7.1/sync';

import { lowerAll, parseFiles, programFilesOf } from './check.ts';

const dir = join(import.meta.dirname, 'fixtures/duplicate-tag');

function lowerFixture() {
  const api = new API({ cwd: dir });

  try {
    const parsed = parseFiles(
      api,
      ['a.ts', 'app.ts', 'b.ts'].map((name) => join(dir, name)),
    );

    return lowerAll(
      parsed,
      programFilesOf(
        api,
        parsed.filter((file) => file.sites.length > 0),
      ),
    );
  } finally {
    api.close();
  }
}

describe('a tag two files define', () => {
  const { lowered, duplicates } = lowerFixture();

  const text = (name: string) =>
    lowered.find((file) => file.path === join(dir, name))?.text ?? '';

  it('types each file template with its own class', () => {
    assert.match(text('a.ts'), /"light-card": ACard;/);
    assert.doesNotMatch(text('a.ts'), /BCard/);
    assert.match(text('b.ts'), /"light-card": BCard;/);
    assert.doesNotMatch(text('b.ts'), /ACard/);
  });

  it('types an importing file template with the imported class', () => {
    assert.match(text('app.ts'), /"light-card": import\("\.\/b\.js"\)\.BCard;/);
    assert.doesNotMatch(text('app.ts'), /ACard/);
  });

  it('reports one duplicate definition', () => {
    assert.deepEqual(
      duplicates.map(({ tag, path, first }) => [
        tag,
        basename(path),
        basename(first),
      ]),
      [['light-card', 'b.ts', 'a.ts']],
    );
  });
});
