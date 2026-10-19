// Generates the regions table from REGIONS and holds the README's copy to it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { REGION_NAMES, REGIONS } from './release-ledger.core.ts';

const README = new URL('../README.md', import.meta.url);

const code = (columns: readonly string[]): string =>
  columns.length === 0
    ? '—'
    : columns.map((column) => `\`${column}\``).join(', ');

function table(): string {
  return [
    '| Region | Lifecycle | Fixed facts | Mutable facts | Conflict | Cleared by |',
    '| --- | --- | --- | --- | --- | --- |',
    ...REGION_NAMES.map((region) => {
      const { fixed, mutable, edges } = REGIONS[region];

      const lifecycle =
        edges.length === 0
          ? '—'
          : edges.map(([from, to]) => `${from} → ${to}`).join(', ');

      return `| ${region} | ${lifecycle} | ${code(fixed)} | ${code(mutable)} | \`${region}_conflict\` | \`repair ${region}\` |`;
    }),
  ].join('\n');
}

// oxfmt pads the cells, so compare them trimmed
const cells = (markdown: string): string[][] =>
  markdown.split('\n').map((line) =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .map((cell) => (/^-+$/.test(cell) ? '---' : cell)),
  );

describe('regions table', () => {
  it('matches the README', () => {
    const readme = readFileSync(README, 'utf8');
    const block = /^\| Region \|.*(?:\n\|.*)*/m.exec(readme)?.[0];

    assert.deepEqual(
      cells(block ?? ''),
      cells(table()),
      'regenerate the README table',
    );
  });
});
