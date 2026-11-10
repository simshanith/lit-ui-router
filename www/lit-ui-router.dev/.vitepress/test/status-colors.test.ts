import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parse } from 'postcss';

import {
  contrast,
  oklchLightness,
  readStatusColors,
  type Theme,
} from './color.ts';

const WHITE = '#ffffff';

const BLACK = '#000000';

const { fills, inkRules } = readStatusColors();

const themes: Theme[] = ['light', 'dark'];

const site = join(import.meta.dirname, '../..');

const rules = parse(
  readFileSync(join(site, '.vitepress/theme/custom.css'), 'utf8'),
).nodes.filter((node) => node.type === 'rule');

const SHARED = '.VPBadge:is(';

const shared = rules
  .map((rule) => rule.selector.replaceAll(/\s+/g, ''))
  .find((selector) => selector.startsWith(SHARED));

const sharedList = new Set(
  shared?.slice(SHARED.length, shared.lastIndexOf(')')).split(','),
);

function badgeGaps(status: string): string[] {
  const selector = `.VPBadge.status-${status}`;
  const rule = rules.find((r) => r.selector === selector);

  const values = new Map(
    rule?.nodes
      .filter((node) => node.type === 'decl')
      .map(({ prop, value }) => [prop, value.replaceAll(/\s+/g, '')]),
  );

  const gaps = Object.entries({
    '--status-fill': `var(--status-${status})`,
    '--status-fill-ink': `var(--status-${status}-ink)`,
  })
    .filter(([prop, value]) => values.get(prop) !== value)
    .map(
      ([prop, value]) =>
        `status-${status}: ${selector} lacks ${prop}: ${value}`,
    );

  if (!sharedList.has(`.status-${status}`))
    gaps.push(`status-${status}: not in the shared ${SHARED}…) rule`);

  return gaps;
}

const badgeTypes = globSync('**/*.md', {
  cwd: site,
  exclude: (path) => ['node_modules', 'dist'].includes(path),
}).flatMap((path) =>
  [
    ...readFileSync(join(site, path), 'utf8').matchAll(
      /<Badge type="status-([a-z-]+)"/g,
    ),
  ].map(([, status]) => ({ path, status })),
);

describe('HTTP status colors', () => {
  it('defines every status in both themes', () => {
    assert.ok(fills.light.size > 0);
    assert.deepEqual([...fills.dark.keys()], [...fills.light.keys()]);
  });

  it('computes every ink from its fill with one threshold', () => {
    assert.deepEqual([...inkRules.keys()], [...fills.light.keys()]);
    assert.equal(new Set(inkRules.values()).size, 1);
  });

  it('styles a status badge for every status', () => {
    assert.deepEqual([...fills.light.keys()].flatMap(badgeGaps), []);
  });

  it('badges only defined statuses in the docs', () => {
    assert.ok(badgeTypes.length > 0);

    for (const { path, status } of badgeTypes)
      assert.ok(fills.light.has(status), `${path}: status-${status}`);
  });

  for (const theme of themes) {
    for (const [status, fill] of fills[theme]) {
      it(`${status} (${theme}) takes the higher-contrast ink, at 4.5:1`, () => {
        const threshold = inkRules.get(status) ?? Number.NaN;
        const computed = oklchLightness(fill) < threshold ? WHITE : BLACK;

        const best =
          contrast(fill, WHITE) >= contrast(fill, BLACK) ? WHITE : BLACK;

        assert.equal(computed, best);
        assert.ok(contrast(fill, computed) >= 4.5);
      });
    }
  }
});
