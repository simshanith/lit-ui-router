import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse, type Declaration, type Root, type Rule } from 'postcss';

export type Theme = 'light' | 'dark';

export interface StatusColors {
  fills: Record<Theme, Map<string, string>>;
  ink: Record<Theme, string>;
  inkRules: Map<string, number>;
}

const CSS = join(import.meta.dirname, '../theme/custom.css');

const START = '=== HTTP status colors';

const END = '=== end HTTP status colors ===';

const FILL = /^--status-([a-z-]+)$/;

const HEX = /^#[0-9a-f]{6}$/;

const INK =
  /^oklch\(\s*from var\(--status-([a-z-]+)\) clamp\(0, \(([\d.]+) - l\) \* 1000, 1\) 0 0\s*\)$/;

// The rules between the block's opening and closing comments, at any depth.
function blockRules(root: Root): Rule[] {
  const start = root.nodes.findIndex(
    (node) => node.type === 'comment' && node.text.startsWith(START),
  );

  const end = root.nodes.findIndex(
    (node) => node.type === 'comment' && node.text === END,
  );

  if (start < 0 || end < start)
    throw new Error('custom.css has no HTTP status colors block');

  const rules: Rule[] = [];

  for (const node of root.nodes.slice(start + 1, end)) {
    if (node.type === 'rule') rules.push(node);

    if (node.type === 'atrule')
      node.walkRules((rule) => {
        rules.push(rule);
      });
  }

  return rules;
}

function declarations(rule: Rule): Declaration[] {
  return rule.nodes.filter((node) => node.type === 'decl');
}

function readFills(rules: Rule[]): StatusColors['fills'] {
  const fills: StatusColors['fills'] = { light: new Map(), dark: new Map() };

  for (const rule of rules) {
    if (rule.selector !== 'html' && rule.selector !== 'html.dark') continue;

    const theme: Theme = rule.selector === 'html.dark' ? 'dark' : 'light';

    for (const { prop, value } of declarations(rule)) {
      const name = FILL.exec(prop)?.[1];

      if (name && HEX.test(value)) fills[theme].set(name, value);
    }
  }

  return fills;
}

function readInkRules(rules: Rule[]): Map<string, number> {
  const inkRules = new Map<string, number>();

  for (const { prop, value } of rules.flatMap(declarations)) {
    const [, name, t] = INK.exec(value.replaceAll(/\s+/g, ' ')) ?? [];

    if (name && prop === `--status-${name}-ink`) inkRules.set(name, Number(t));
  }

  return inkRules;
}

export function readStatusColors(
  css = readFileSync(CSS, 'utf8'),
): StatusColors {
  const rules = blockRules(parse(css));
  const fills = readFills(rules);
  const light = fills.light.get('ink');
  const dark = fills.dark.get('ink');

  if (!light || !dark) throw new Error('--status-ink is missing a theme');

  fills.light.delete('ink');
  fills.dark.delete('ink');

  return { fills, ink: { light, dark }, inkRules: readInkRules(rules) };
}

function linear(channel: number): number {
  const s = channel / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);

  return [linear((n >> 16) & 255), linear((n >> 8) & 255), linear(n & 255)];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (hi + 0.05) / (lo + 0.05);
}

export function oklchLightness(hex: string): number {
  const [r, g, b] = channels(hex);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  return (
    0.2104542553 * Math.cbrt(l) +
    0.793617785 * Math.cbrt(m) -
    0.0040720468 * Math.cbrt(s)
  );
}
