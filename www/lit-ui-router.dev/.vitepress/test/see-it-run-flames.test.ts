import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import postcss, { type Declaration } from 'postcss';
import postcssHtml from 'postcss-html';

const FILE = 'HomeSeeItRun.vue';

const { root } = postcss().process(
  readFileSync(join(import.meta.dirname, '../theme/components', FILE), 'utf8'),
  { from: FILE, syntax: postcssHtml },
);

// The declarations that draw the layer the scroll offset moves.
const layer: Declaration[] = [];

root.walkRules('.flames::before', (rule) => {
  rule.walkDecls((decl) => {
    layer.push(decl);
  });
});

describe('the home tour flame layer', () => {
  // Chromium resolves an image again whenever a custom property the element inherits changes, and repaints the layer every frame.
  it('names its tile in a declaration with no var()', () => {
    const images = layer.filter(({ value }) => value.includes('url('));

    assert.deepEqual(
      images.map(({ prop }) => prop),
      ['mask-image'],
    );
    assert.deepEqual(
      images.filter(({ value }) => value.includes('var(')),
      [],
    );
  });
});
