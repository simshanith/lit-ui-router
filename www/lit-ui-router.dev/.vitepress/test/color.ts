import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Theme = 'light' | 'dark';

export interface StatusColors {
  fills: Record<Theme, Map<string, string>>;
  ink: Record<Theme, string>;
  inkRules: Map<string, number>;
}

// VitePress's --vp-c-bg in each theme.
export const pageBackground: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1b1b1f',
};

const CSS = join(import.meta.dirname, '../theme/custom.css');

const BLOCK =
  /\/\* === HTTP status colors[\s\S]*?\/\* === end HTTP status colors === \*\//;

const RULE = /(html(?:\.dark)?)\s*\{([^{}]*)\}/g;

const FILL = /--status-([a-z-]+?):\s*(#[0-9a-f]{6});/g;

const INK =
  /--status-([a-z-]+)-ink:\s*oklch\(from var\(--status-\1\) clamp\(0, \(([\d.]+) - l\) \* 1000, 1\) 0 0\);/g;

export function readStatusColors(
  css = readFileSync(CSS, 'utf8'),
): StatusColors {
  const block = BLOCK.exec(css)?.[0];

  if (!block) throw new Error('custom.css has no HTTP status colors block');

  const fills: StatusColors['fills'] = { light: new Map(), dark: new Map() };

  for (const [, selector, body] of block.matchAll(RULE)) {
    const theme: Theme = selector === 'html.dark' ? 'dark' : 'light';

    for (const [, name, hex] of body.matchAll(FILL))
      fills[theme].set(name, hex);
  }

  const light = fills.light.get('ink');
  const dark = fills.dark.get('ink');

  if (!light || !dark) throw new Error('--status-ink is missing a theme');

  fills.light.delete('ink');
  fills.dark.delete('ink');

  const inkRules = new Map(
    [...block.matchAll(INK)].map(([, name, t]) => [name, Number(t)]),
  );

  return { fills, ink: { light, dark }, inkRules };
}

function linear(channel: number): number {
  const s = channel / 255;

  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);

  return [linear((n >> 16) & 255), linear((n >> 8) & 255), linear(n & 255)];
}

export function luminance(hex: string): number {
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
