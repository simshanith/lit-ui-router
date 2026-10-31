import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  contrast,
  oklchLightness,
  pageBackground,
  readStatusColors,
  type Theme,
} from './color.ts';

const WHITE = '#ffffff';

const BLACK = '#000000';

const { fills, ink, inkRules } = readStatusColors();

const themes: Theme[] = ['light', 'dark'];

const site = join(import.meta.dirname, '../..');

const css = readFileSync(join(site, '.vitepress/theme/custom.css'), 'utf8');

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
    for (const status of fills.light.keys())
      assert.ok(
        css.includes(
          `.VPBadge.status-${status} {\n  --status-fill: var(--status-${status});\n  --status-fill-ink: var(--status-${status}-ink);\n}`,
        ),
        status,
      );
  });

  it('badges only defined statuses in the docs', () => {
    assert.ok(badgeTypes.length > 0);

    for (const { path, status } of badgeTypes)
      assert.ok(fills.light.has(status), `${path}: status-${status}`);
  });

  for (const theme of themes) {
    for (const [status, fill] of fills[theme]) {
      it(`${status} (${theme}) holds 3:1 against the page`, () => {
        assert.ok(contrast(fill, pageBackground[theme]) >= 3);
      });

      it(`${status} (${theme}) takes the higher-contrast ink, at 4.5:1`, () => {
        const threshold = inkRules.get(status) ?? Number.NaN;
        const computed = oklchLightness(fill) < threshold ? WHITE : BLACK;

        const best =
          contrast(fill, WHITE) >= contrast(fill, BLACK) ? WHITE : BLACK;

        assert.equal(computed, best);
        assert.ok(contrast(fill, computed) >= 4.5);
      });

      it(`${status} (${theme}) holds 4.5:1 with the fallback ink`, () => {
        assert.ok(contrast(fill, ink[theme]) >= 4.5);
      });
    }
  }
});
