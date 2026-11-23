import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import postcss, { parse, type Declaration } from 'postcss';
import postcssHtml from 'postcss-html';

import { contrast } from './color.ts';

const FILE = 'SiteFooter.vue';

const THEME = join(import.meta.dirname, '../theme');

const component = readFileSync(join(THEME, 'components', FILE), 'utf8');

const { root } = postcss().process(component, {
  from: FILE,
  syntax: postcssHtml,
});

const mask = readFileSync(
  join(import.meta.dirname, '../../public/images/lit-ui-router-flames.svg'),
  'utf8',
);

// The declarations of the box the highlight crosses.
const box: Declaration[] = [];

root.walkRules('.gradient-mark', (rule) => {
  rule.walkDecls((decl) => {
    box.push(decl);
  });
});

const attribute = (markup: string, name: string): string | undefined =>
  new RegExp(` ${name}="([^"]+)"`).exec(markup)?.[1];

const SCOPE = { light: ':root', dark: '.dark' } as const;

type Theme = keyof typeof SCOPE;

/** A custom property's own value in a theme, from tokens.css and then VitePress's vars.css. */
function token(theme: Theme, property: string): string {
  const sources = [
    readFileSync(join(THEME, 'tokens.css'), 'utf8'),
    readFileSync(
      join(
        dirname(
          createRequire(import.meta.url).resolve('vitepress/package.json'),
        ),
        'dist/client/theme-default/styles/vars.css',
      ),
      'utf8',
    ),
  ];

  for (const scope of [SCOPE[theme], SCOPE.light]) {
    for (const css of sources) {
      let found: string | undefined;

      parse(css).each((rule) => {
        if (rule.type !== 'rule' || rule.selector !== scope) return;

        rule.walkDecls(property, ({ value }) => {
          found = value;
        });
      });

      if (found) return found;
    }
  }

  throw new Error(`${property} is undefined in ${theme}`);
}

const hexToken = (theme: Theme, property: string): string => {
  const value = token(theme, property);
  const next = /^var\((--[\w-]+)\)$/.exec(value)?.[1];

  return next ? hexToken(theme, next) : value;
};

/** White at an alpha over a hex colour. */
const lit = (hex: string, alpha: number): string =>
  `#${[1, 3, 5]
    .map((at) =>
      Math.round(
        Number.parseInt(hex.slice(at, at + 2), 16) * (1 - alpha) + 255 * alpha,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

describe('the home footer mark', () => {
  // Chromium resolves an image again whenever a custom property the element inherits changes, and repaints the layer every frame.
  it('names its mask in a declaration with no var()', () => {
    const images = box.filter(({ value }) => value.includes('url('));

    assert.deepEqual(
      images.map(({ prop, value }) => [prop, value]),
      [['mask-image', 'url(/images/lit-ui-router-flames.svg)']],
    );
  });

  it('cuts the gradient to the flames the inline mark draws', () => {
    for (const name of ['viewBox', 'd'])
      assert.equal(attribute(mask, name), attribute(component, name), name);

    const [, , width, height] = attribute(mask, 'viewBox')?.split(' ') ?? [];

    assert.equal(
      box.find(({ prop }) => prop === 'aspect-ratio')?.value,
      `${width} / ${height}`,
    );
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`holds 3:1 on the soft surface under the highlight's peak (${theme})`, () => {
      const ground = hexToken(theme, '--vp-c-bg-soft');

      const peak = Math.max(
        ...[
          ...token(theme, '--site-footer-mark-sheen').matchAll(
            /rgb\(255 255 255 \/ ([\d.]+)\)/g,
          ),
        ].map(([, alpha]) => Number(alpha)),
      );

      assert.ok(peak > 0);

      for (const stop of [
        '--site-color-footer-mark-start',
        '--site-color-identity-ink',
        '--site-color-footer-mark-end',
      ]) {
        const ratio = contrast(lit(hexToken(theme, stop), peak), ground);

        assert.ok(ratio >= 3, `${stop}: ${ratio.toFixed(2)}:1 is under 3:1`);
      }
    });
  }
});
