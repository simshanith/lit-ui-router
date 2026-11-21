import postcssLit from 'postcss-lit';
import type { AnyNode, Builder, Root, Stringifier } from 'postcss';

import type { Span } from './templates.ts';

interface Written {
  lit: string;
  source: string;
}

const written = new WeakMap<AnyNode, Map<string, Written>>();

/** The source text postcss-lit writes as `lit`, a character of `source` at a time; `undefined` past a mismatch. */
function sourceLength(
  lit: string,
  source: string,
  from: number,
  holes: Span[],
): number | undefined {
  let i = 0;
  let j = from;

  while (i < lit.length) {
    const hole = holes.find((h) => h.start === j);

    if (hole) {
      const expression = source.slice(hole.start, hole.end);

      if (!lit.startsWith(expression, i)) return undefined;
      i += expression.length;
      j = hole.end;
      continue;
    }

    // postcss-lit writes `\\` back as is, but doubles a lone `\` and escapes a backtick
    const want = /[\\`]/.test(source[j]) ? `\\${source[j]}` : source[j];
    const pair = source.startsWith('\\\\', j);

    if (!lit.startsWith(want, i)) return undefined;
    i += want.length;
    j += pair ? 2 : 1;
  }

  return j - from;
}

/** Records the source text of each fragment postcss-lit writes for `root`, the CSS of `span`. */
export function remember(
  root: Root,
  source: string,
  span: Span,
  holes: Span[],
): void {
  const parts = new Map<AnyNode, Map<string, Written>>();
  let at = span.start;
  let aligned = true;

  postcssLit.stringify(root, (lit, node, type) => {
    if (!aligned || node === root) return;
    const length = sourceLength(lit, source, at, holes);

    if (length === undefined) {
      aligned = false;

      return;
    }

    if (node) {
      const part = parts.get(node) ?? new Map<string, Written>();

      part.set(type ?? '', { lit, source: source.slice(at, at + length) });
      parts.set(node, part);
    }

    at += length;
  });

  if (!aligned || at !== span.end) return;

  for (const [node, part] of parts) written.set(node, part);
}

/** postcss-lit's stringify, but a remembered fragment that is unchanged is written as its source. */
export const stringify: Stringifier = (node, builder: Builder) => {
  postcssLit.stringify(node, (lit, part, type) => {
    const memo = part && written.get(part)?.get(type ?? '');

    builder(memo?.lit === lit ? memo.source : lit, part, type);
  });
};
