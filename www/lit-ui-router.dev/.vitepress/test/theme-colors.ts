// The theme's custom properties resolved to colours, per colour scheme: tokens.css and custom.css over VitePress's vars.css.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { parse } from 'postcss';

import type { Theme } from './color.ts';
import { GROUNDS, type GroundName } from '../theme/color-roles.ts';

export type Rgba = [number, number, number, number];

export const THEME_DIR = join(import.meta.dirname, '../theme');

export const tokensCss = readFileSync(join(THEME_DIR, 'tokens.css'), 'utf8');

// Status colours stay beside the badge rules that use them.
export const customCss = readFileSync(join(THEME_DIR, 'custom.css'), 'utf8');

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

export function parseColor(value: string): Rgba {
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

export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3];

  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

export function color(theme: Theme, property: string): Rgba {
  return parseColor(resolve(theme, `var(${property})`));
}

export function ground(theme: Theme, name: GroundName): Rgba {
  const spec: { property: string; over?: GroundName } = GROUNDS[name];
  const own = color(theme, spec.property);

  if (own[3] === 1) return own;

  assert.ok(spec.over, `${name} is translucent and names no ground beneath`);

  return over(own, ground(theme, spec.over));
}

export function hex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}
