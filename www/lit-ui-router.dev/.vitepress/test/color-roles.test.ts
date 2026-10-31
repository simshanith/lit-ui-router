import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import {
  GROUNDS,
  MINIMUM,
  ROLES,
  type GroundName,
} from '../theme/color-roles.ts';

type Theme = 'light' | 'dark';

type Rgba = [number, number, number, number];

const THEME_DIR = join(import.meta.dirname, '../theme');

const customCss = readFileSync(join(THEME_DIR, 'custom.css'), 'utf8');

const varsCss = readFileSync(
  join(
    dirname(createRequire(import.meta.url).resolve('vitepress/package.json')),
    'dist/client/theme-default/styles/vars.css',
  ),
  'utf8',
);

const SCOPES: Record<Theme, readonly string[]> = {
  light: [':root', 'html', ':root:not(.dark)'],
  dark: [':root', 'html', '.dark', 'html.dark', ':root.dark'],
};

// Top-level rules only: at-rule blocks (@media, @supports) are progressive overrides, not the base value.
function* topLevelRules(css: string): Generator<[string, string]> {
  const text = css.replaceAll(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let start = 0;
  let prelude = '';

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) {
        prelude = text.slice(start, i).trim();
        start = i + 1;
      }

      depth++;
    } else if (text[i] === '}') {
      depth--;

      if (depth === 0) {
        if (!prelude.startsWith('@')) yield [prelude, text.slice(start, i)];
        start = i + 1;
      }
    }
  }
}

function customProperties(theme: Theme): Map<string, string> {
  const props = new Map<string, string>();

  for (const css of [varsCss, customCss]) {
    for (const [selector, body] of topLevelRules(css)) {
      if (!SCOPES[theme].includes(selector)) continue;

      for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
        props.set(name, value.trim());
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

function luminance([r, g, b]: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;

    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

const themes: Theme[] = ['light', 'dark'];

const statusDefined = PROPS.light.has('--status-ok');

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
        it(
          `${role.property} on ${name} (${theme}) holds ${minimum}:1`,
          {
            skip:
              'status' in role && !statusDefined
                ? 'the HTTP status colors block is not in custom.css yet'
                : false,
          },
          () => {
            const bg = ground(theme, name);
            const ratio = contrast(over(color(theme, role.property), bg), bg);

            assert.ok(
              ratio >= minimum,
              `${ratio.toFixed(2)}:1 is under ${minimum}:1`,
            );
          },
        );
      }
    }
  }

  it('lists every --site-color-* property custom.css defines', () => {
    const listed = new Set<string>([
      ...ROLES.map((r) => r.property),
      ...Object.values(GROUNDS).map((g) => g.property),
    ]);

    const defined = new Set(
      [...customCss.matchAll(/(--site-color-[\w-]+)\s*:/g)].map(([, p]) => p),
    );

    assert.deepEqual(
      [...defined].filter((p) => !listed.has(p)),
      [],
    );
  });

  it('reaches brand indigo only through the interaction roles', () => {
    const sources = [
      customCss,
      ...readdirSync(join(THEME_DIR, 'components'))
        .filter((f) => f.endsWith('.vue'))
        .map((f) => readFileSync(join(THEME_DIR, 'components', f), 'utf8')),
    ];

    const strays = sources
      .flatMap((s) => s.split('\n'))
      .filter((line) => line.includes('var(--vp-c-brand'))
      .filter((line) => !/^\s*--site-color-interaction[\w-]*:/.test(line));

    assert.deepEqual(strays, []);
  });
});
