import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { AtRule, parse, Rule, type Declaration, type Root } from 'postcss';

import { contrast } from './color.ts';
import {
  GROUNDS,
  MINIMUM,
  ROLES,
  type GroundName,
} from '../theme/color-roles.ts';

type Theme = 'light' | 'dark';

type Rgba = [number, number, number, number];

const THEME_DIR = join(import.meta.dirname, '../theme');

const tokensCss = readFileSync(join(THEME_DIR, 'tokens.css'), 'utf8');

// Status colours stay beside the badge rules that use them.
const customCss = readFileSync(join(THEME_DIR, 'custom.css'), 'utf8');

const releasePagesCss = readFileSync(
  join(import.meta.dirname, '../../worker/releases/release-pages.css'),
  'utf8',
);

const varsCss = readFileSync(
  join(
    dirname(createRequire(import.meta.url).resolve('vitepress/package.json')),
    'dist/client/theme-default/styles/vars.css',
  ),
  'utf8',
);

const STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g;

const components = readdirSync(join(THEME_DIR, 'components'))
  .filter((file) => file.endsWith('.vue'))
  .map((file) => {
    const sfc = readFileSync(join(THEME_DIR, 'components', file), 'utf8');

    return {
      file,
      styles: [...sfc.matchAll(STYLE)].map(([, css]) => css).join('\n'),
      markup: sfc.replaceAll(STYLE, ''),
    };
  });

interface Source {
  file: string;
  root: Root;
}

function uses(text: string, prefix: string): boolean {
  return text.replaceAll(/\s+/g, '').includes(`var(${prefix}`);
}

function where({ parent }: Declaration): string {
  if (parent instanceof Rule) return parent.selector;

  return parent instanceof AtRule ? `@${parent.name} ${parent.params}` : '';
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

const SCOPES: Record<Theme, readonly string[]> = {
  light: [':root', 'html', ':root:not(.dark)'],
  dark: [':root', 'html', '.dark', 'html.dark', ':root.dark'],
};

function customProperties(theme: Theme): Map<string, string> {
  const props = new Map<string, string>();

  for (const css of [varsCss, tokensCss, customCss]) {
    // Top-level rules only: at-rule blocks (@media, @supports) are progressive overrides, not the base value.
    for (const rule of parse(css).nodes) {
      if (rule.type !== 'rule' || !SCOPES[theme].includes(rule.selector))
        continue;

      for (const decl of rule.nodes)
        if (decl.type === 'decl' && decl.prop.startsWith('--'))
          props.set(decl.prop, decl.value);
    }
  }

  return props;
}

const PROPS: Record<Theme, Map<string, string>> = {
  light: customProperties('light'),
  dark: customProperties('dark'),
};

function resolve(
  theme: Theme,
  value: string,
  seen = new Set<string>(),
): string {
  return value.replaceAll(
    /var\((--[\w-]+)(?:,\s*([^)]+))?\)/g,
    (_, name: string, fallback?: string) => {
      const next = PROPS[theme].get(name) ?? fallback;

      if (next === undefined || seen.has(name))
        throw new Error(`${name} is undefined in ${theme}`);

      return resolve(theme, next, new Set([...seen, name]));
    },
  );
}

function parseColor(value: string): Rgba {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)?.[1];

  if (hex) {
    const full = hex.length === 3 ? hex.replaceAll(/./g, '$&$&') : hex;
    const n = Number.parseInt(full, 16);

    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }

  const rgb = /^rgba?\(([^)]+)\)$/.exec(value)?.[1];

  if (rgb) {
    const [r, g, b, a = 1] = rgb
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);

    return [r, g, b, a];
  }

  throw new Error(`unsupported colour ${value}`);
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];

  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

function color(theme: Theme, property: string): Rgba {
  return parseColor(resolve(theme, `var(${property})`));
}

function ground(theme: Theme, name: GroundName): Rgba {
  const spec: { property: string; over?: GroundName } = GROUNDS[name];
  const own = color(theme, spec.property);

  if (own[3] === 1) return own;

  assert.ok(spec.over, `${name} is translucent and names no ground beneath`);

  return over(own, ground(theme, spec.over));
}

function hex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
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
      ...components.map(({ file, styles }) => ({ file, root: parse(styles) })),
    ];

    const strays = straysIn(
      sources,
      (decl) =>
        uses(decl.value, '--vp-c-brand') &&
        !decl.prop.startsWith('--site-color-interaction'),
    );

    assert.deepEqual(strays, []);

    // Templates and scripts can't declare an interaction role, so any use is a stray.
    assert.deepEqual(
      components
        .filter(({ markup }) => uses(markup, '--vp-c-brand'))
        .map(({ file }) => `${file}: template or script`),
      [],
    );
  });

  it('colours the release pages only through the site roles', () => {
    const strays = straysIn(
      [{ file: 'release-pages.css', root: parse(releasePagesCss) }],
      (decl) => uses(decl.value, '--vp-c-'),
    );

    assert.deepEqual(strays, []);
  });
});
