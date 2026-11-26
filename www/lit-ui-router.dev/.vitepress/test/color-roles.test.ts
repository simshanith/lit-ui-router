import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import postcss, {
  AtRule,
  parse,
  Rule,
  type Declaration,
  type Document,
  type Root,
} from 'postcss';
import postcssHtml from 'postcss-html';

import { contrast, type Theme } from './color.ts';
import {
  color,
  customCss,
  ground,
  hex,
  over,
  THEME_DIR,
  tokensCss,
} from './theme-colors.ts';
import { GROUNDS, MINIMUM, ROLES } from '../theme/color-roles.ts';

const releasePagesCss = readFileSync(
  join(import.meta.dirname, '../../worker/releases/release-pages.css'),
  'utf8',
);

interface Source {
  file: string;
  root: Root | Document;
}

// postcss-html yields one root per <style> block and per style="…" attribute.
const components: Source[] = readdirSync(join(THEME_DIR, 'components'))
  .filter((file) => file.endsWith('.vue'))
  .map((file) => ({
    file,
    root: postcss().process(
      readFileSync(join(THEME_DIR, 'components', file), 'utf8'),
      { from: file, syntax: postcssHtml },
    ).root,
  }));

function uses(text: string, prefix: string): boolean {
  return text.replaceAll(/\s+/g, '').includes(`var(${prefix}`);
}

function where({ parent }: Declaration): string {
  if (parent instanceof Rule) return parent.selector;

  return parent instanceof AtRule
    ? `@${parent.name} ${parent.params}`
    : 'style attribute';
}

function straysIn(
  sources: Source[],
  stray: (decl: Declaration) => boolean,
): string[] {
  const found: string[] = [];

  for (const { file, root } of sources)
    root.walkDecls((decl) => {
      if (stray(decl))
        found.push(
          `${file}: ${where(decl)} { ${decl.prop}: ${decl.value.replaceAll(/\s+/g, ' ')} }`,
        );
    });

  return found;
}

const themes: Theme[] = ['light', 'dark'];

describe('colour roles', () => {
  for (const role of ROLES) {
    if (role.kind === 'exempt') {
      it(`${role.property} states why it has no minimum`, () => {
        assert.ok(role.exempt);
        assert.deepEqual(role.on, []);
      });
      continue;
    }

    const minimum = MINIMUM[role.kind];

    for (const theme of themes) {
      for (const name of role.on) {
        it(`${role.property} on ${name} (${theme}) holds ${minimum}:1`, () => {
          const bg = ground(theme, name);

          const ratio = contrast(
            hex(over(color(theme, role.property), bg)),
            hex(bg),
          );

          assert.ok(
            ratio >= minimum,
            `${ratio.toFixed(2)}:1 is under ${minimum}:1`,
          );
        });
      }
    }
  }

  it('lists every --site-color-* property the theme defines', () => {
    const listed = new Set<string>([
      ...ROLES.map((r) => r.property),
      ...Object.values(GROUNDS).map((g) => g.property),
    ]);

    const defined = new Set<string>();

    for (const css of [tokensCss, customCss])
      parse(css).walkDecls(/^--site-color-/, ({ prop }) => {
        defined.add(prop);
      });

    assert.deepEqual(
      [...defined].filter((p) => !listed.has(p)),
      [],
    );
  });

  it('reaches the brand scale only through the interaction roles', () => {
    const sources: Source[] = [
      { file: 'tokens.css', root: parse(tokensCss) },
      { file: 'custom.css', root: parse(customCss) },
      { file: 'release-pages.css', root: parse(releasePagesCss) },
      ...components,
    ];

    const strays = straysIn(
      sources,
      (decl) =>
        uses(decl.value, '--vp-c-brand') &&
        !decl.prop.startsWith('--site-color-interaction'),
    );

    assert.deepEqual(strays, []);
  });

  it('colours the release pages only through the site roles', () => {
    const strays = straysIn(
      [{ file: 'release-pages.css', root: parse(releasePagesCss) }],
      (decl) => uses(decl.value, '--vp-c-'),
    );

    assert.deepEqual(strays, []);
  });
});
