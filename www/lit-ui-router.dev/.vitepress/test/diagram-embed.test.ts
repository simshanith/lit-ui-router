import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '../..');

const diagrams = join(root, 'public/diagrams');

const INCLUDE = /<!--\s*@include:\s*(\S+?)\s*-->/g;

function* markdownFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

    const path = join(dir, entry.name);

    if (entry.isDirectory()) yield* markdownFiles(path);
    else if (entry.name.endsWith('.md')) yield relative(root, path);
  }
}

const pages = [...markdownFiles(root)];

const nextLine = (lines: string[], from: number, step: 1 | -1) => {
  for (let i = from + step; i >= 0 && i < lines.length; i += step) {
    if (lines[i].trim() !== '') return lines[i].trim();
  }

  return '';
};

// Every inlined diagram sits alone in a <DiagramEmbed> whose src serves the same file.
function unwrappedIncludes(markdown: string, file: string): string[] {
  const lines = markdown.split('\n');
  const problems: string[] = [];

  for (const [index, line] of lines.entries()) {
    for (const [, target] of line.matchAll(INCLUDE)) {
      const path = resolve(dirname(file), target);

      if (dirname(path) !== diagrams || !path.endsWith('.svg')) continue;

      const open = `<DiagramEmbed src="/diagrams/${basename(path)}">`;
      const alone = line.trim() === `<!--@include: ${target}-->`;

      if (
        !alone ||
        nextLine(lines, index, -1) !== open ||
        nextLine(lines, index, 1) !== '</DiagramEmbed>'
      ) {
        problems.push(`${relative(root, file)}:${index + 1} ${target}`);
      }
    }
  }

  return problems;
}

describe('DiagramEmbed call sites', () => {
  it('wrap every @include of public/diagrams/*.svg in a <DiagramEmbed> naming the same file', () => {
    const problems = pages.flatMap((page) => {
      const file = join(root, page);

      return unwrappedIncludes(readFileSync(file, 'utf8'), file);
    });

    assert.deepEqual(problems, []);
  });

  it('find at least one inlined diagram', () => {
    const count = pages.reduce(
      (sum, page) =>
        sum +
        (readFileSync(join(root, page), 'utf8').match(INCLUDE)?.length ?? 0),
      0,
    );

    assert.ok(count > 0);
  });
});

describe('unwrappedIncludes', () => {
  const file = join(root, 'guides/page.md');

  const include = '<!--@include: ../public/diagrams/a.svg-->';

  it('passes a wrapped include', () => {
    const md = `<DiagramEmbed src="/diagrams/a.svg">\n\n${include}\n\n</DiagramEmbed>\n`;

    assert.deepEqual(unwrappedIncludes(md, file), []);
  });

  it('fails a bare include', () => {
    assert.deepEqual(unwrappedIncludes(`Text\n\n${include}\n`, file), [
      'guides/page.md:3 ../public/diagrams/a.svg',
    ]);
  });

  it('fails a src naming another diagram', () => {
    const md = `<DiagramEmbed src="/diagrams/b.svg">\n\n${include}\n\n</DiagramEmbed>\n`;

    assert.equal(unwrappedIncludes(md, file).length, 1);
  });

  it('ignores includes outside public/diagrams', () => {
    assert.deepEqual(
      unwrappedIncludes('<!--@include: ../snippets/a.md-->\n', file),
      [],
    );
  });
});
