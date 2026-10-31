import { readStatusColors } from './color.ts';

export interface Element {
  name: string;
  attrs: Map<string, string>;
  // nested inside an icon's own <svg>
  inIcon: boolean;
  // nested inside a data-brand subtree
  inBrand: boolean;
  line: number;
}

export interface Diagram {
  root: Element;
  style: string | undefined;
  elements: Element[];
}

export interface Role {
  light: string;
  dark: string;
}

// VitePress's palette as the diagrams use it: light value as the var() fallback, dark value for the file's own <style>.
const vitepress = {
  'vp-c-bg': { light: '#ffffff', dark: '#1b1b1f' },
  'vp-c-bg-soft': { light: '#f6f6f7', dark: '#202127' },
  'vp-c-divider': { light: '#e2e2e3', dark: '#2e2e32' },
  'vp-c-text-1': { light: '#3c3c43', dark: '#dfdfd6' },
  'vp-c-text-2': { light: '#67676c', dark: '#98989f' },
  'vp-c-text-3': { light: '#929295', dark: '#6a6a71' },
  'vp-c-brand-1': { light: '#3451b2', dark: '#a8b1ff' },
  'vp-c-brand-soft': {
    light: 'rgba(100,108,255,0.14)',
    dark: 'rgba(100, 108, 255, 0.16)',
  },
  'vp-c-default-soft': {
    light: 'rgba(142,150,170,0.14)',
    dark: 'rgba(101, 117, 133, 0.16)',
  },
  'vp-c-green-1': { light: '#18794e', dark: '#3dd68c' },
  'vp-c-green-soft': {
    light: 'rgba(16,185,129,0.14)',
    dark: 'rgba(16, 185, 129, 0.16)',
  },
  'vp-c-red-1': { light: '#b8272c', dark: '#f66f81' },
  'vp-c-red-soft': {
    light: 'rgba(244,63,94,0.14)',
    dark: 'rgba(244, 63, 94, 0.16)',
  },
  'vp-c-purple-1': { light: '#6f42c1', dark: '#c8abfa' },
  'vp-c-purple-soft': {
    light: 'rgba(159,122,234,0.14)',
    dark: 'rgba(159, 122, 234, 0.16)',
  },
} satisfies Record<string, Role>;

function statusRoles(): [string, Role][] {
  const { fills, ink } = readStatusColors();

  return [...fills.light].flatMap(([status, light]): [string, Role][] => [
    [`status-${status}`, { light, dark: fills.dark.get(status) ?? '' }],
    [`status-${status}-ink`, { light: ink.light, dark: ink.dark }],
  ]);
}

export const palette = new Map<string, Role>([
  ...Object.entries(vitepress),
  ...statusRoles(),
]);

export const FONT_BASE =
  'var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)';

export const FONT_MONO = 'var(--vp-font-family-mono, ui-monospace, monospace)';

export const STYLE_HEAD =
  '<!-- dark palette applies only when this file is the document root -->';

export function markerFor(id: string): string {
  return [
    `<marker id="${id}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`,
    `      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-2, #67676c)" />`,
    '    </marker>',
  ].join('\n');
}

// The <style> a diagram carries: the dark value of every palette role it uses, in palette order.
export function darkStyleFor(used: Iterable<string>): string {
  const names = new Set(used);

  const lines = [...palette].flatMap(([name, role]) =>
    names.has(name) ? `        --${name}: ${role.dark};` : [],
  );

  return [
    '<style>',
    '    @media (prefers-color-scheme: dark) {',
    '      svg:root {',
    '        color-scheme: dark;',
    ...lines,
    '      }',
    '    }',
    '  </style>',
  ].join('\n');
}

const TAG =
  /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z][\w:-]*="[^"]*")*)\s*(\/?)>|<!--[\s\S]*?-->/g;

const ATTR = /([a-zA-Z][\w:-]*)="([^"]*)"/g;

function elementFor(
  name: string,
  rawAttrs: string | undefined,
  parent: Element | undefined,
  line: number,
): Element {
  const attrs = new Map(
    [...(rawAttrs ?? '').matchAll(ATTR)].map(([, k, v]) => [k, v]),
  );

  return {
    name,
    attrs,
    inIcon: parent !== undefined && (parent.inIcon || name === 'svg'),
    inBrand: parent?.inBrand === true || attrs.has('data-brand'),
    line,
  };
}

export function parseDiagram(source: string): Diagram {
  const styleMatch = /<style>[\s\S]*?<\/style>/.exec(source);
  const style = styleMatch?.[0];
  const body = style ? source.replace(style, ' '.repeat(style.length)) : source;
  const elements: Element[] = [];
  const stack: Element[] = [];

  for (const match of body.matchAll(TAG)) {
    const [whole, closing, name, rawAttrs, selfClosing] = match;

    if (whole.startsWith('<!--')) continue;

    if (closing) {
      stack.pop();
      continue;
    }

    const element = elementFor(
      name,
      rawAttrs,
      stack.at(-1),
      body.slice(0, match.index).split('\n').length,
    );

    elements.push(element);

    if (!selfClosing) stack.push(element);
  }

  const tags = body.replaceAll(/<!--[\s\S]*?-->/g, '').match(/<[a-zA-Z/]/g);
  const closings = body.match(/<\//g)?.length ?? 0;

  if (tags?.length !== elements.length + closings)
    throw new Error('a tag in this diagram is not plain SVG markup');

  return { root: elements[0], style, elements };
}

const VAR = /^var\(--([a-z0-9-]+), ([^)]+\)?)\)$/;

export function colorVar(
  value: string,
): { name: string; fallback: string } | undefined {
  const match = VAR.exec(value);

  return match ? { name: match[1], fallback: match[2] } : undefined;
}
