import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const read = (path: string) =>
  readFileSync(join(import.meta.dirname, path), 'utf8');

const svg = read('../../public/diagrams/server-route-matching-spectrum.svg');

// frameworks.ts imports Vue and extensionless modules, so its `levels` literal is read as text.
const levels = [
  ...read('../theme/components/frameworks.ts').matchAll(
    /\{ n: (\d), name: '([^']+)' \}/g,
  ),
].map(([, n, name]) => ({ n: Number(n), name }));

// Each band opens with an `<!-- L<n> -->` comment; its name is the first label after the numeral.
function svgLevelName(n: number): string | undefined {
  const band = svg.split('<!-- L').find((part) => part.startsWith(`${n} `));

  return [...(band ?? '').matchAll(/<text[^>]*>([^<]+)<\/text>/g)]
    .map(([, text]) => text.replaceAll('&#183;', '·'))
    .find((text) => !/^\d$/.test(text));
}

describe('server-support spectrum level names', () => {
  it('reads six levels from frameworks.ts', () => {
    assert.deepEqual(
      levels.map(({ n }) => n),
      [0, 1, 2, 3, 4, 5],
    );
  });

  for (const { n, name } of levels) {
    it(`names level ${n} in the diagram as <FrameworkSpectrum> does`, () => {
      assert.equal(svgLevelName(n), name);
    });
  }
});
