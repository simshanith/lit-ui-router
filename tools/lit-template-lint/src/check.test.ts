import assert from 'node:assert/strict';
import { basename, join } from 'node:path';
import { before, describe, it } from 'node:test';

import { readFileSync } from 'node:fs';

import { API } from 'typescript-7.1/sync';

import { checkFiles, lowerAll, parseFiles, programFilesOf } from './check.ts';

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

const rules = join(import.meta.dirname, 'fixtures/rules');

const RULE_FILES = ['card.ts', 'styles.ts', 'templates.ts', 'unimported.ts'];

/** `file:line rule` for each `// expect a, b` comment, or its CSS comment form, on the line after it. */
function expected(name: string): string[] {
  const lines = readFileSync(join(rules, name), 'utf8').split('\n');

  return lines.flatMap((line, i) => {
    const match = /(?:\/\/ expect (.+)|\/\* expect (.+) \*\/)$/.exec(line);

    return match
      ? (match[1] ?? match[2])
          .split(', ')
          .map((rule) => `${name}:${i + 2} ${rule}`)
      : [];
  });
}

async function checkRules() {
  const api = new API({ cwd: rules });

  try {
    return await checkFiles(
      api,
      RULE_FILES.map((name) => join(rules, name)),
    );
  } finally {
    api.close();
  }
}

describe('the ported lit-analyzer rules', () => {
  let result: Awaited<ReturnType<typeof checkRules>>;

  before(async () => {
    result = await checkRules();
  });

  const lineOf = (path: string, offset: number) =>
    readFileSync(path, 'utf8').slice(0, offset).split('\n').length;

  it('reports each expected finding and nothing else', () => {
    const actual = result.findings
      .map(
        ({ path, offset, rule }) =>
          `${basename(path)}:${lineOf(path, offset)} ${rule}`,
      )
      .sort();

    assert.deepEqual(actual, RULE_FILES.flatMap(expected).sort());
  });

  it('leaves the prelude clean', () => {
    assert.deepEqual(result.checked.internal, []);
  });

  it('words a report as lit-analyzer does', () => {
    const texts = new Set(result.findings.map(({ text }) => text));

    assert.ok(texts.has(`Type 'string' is not assignable to 'number'`));
    assert.ok(
      texts.has(
        "Missing '{type: Number}' on @property decorator for 'untyped'",
      ),
    );
    assert.ok(texts.has('Missing import for <rule-card>'));
    assert.ok(texts.has('Unknown property "colr" (property-no-unknown)'));
  });
});
