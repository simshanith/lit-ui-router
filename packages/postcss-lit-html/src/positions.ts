import { type Document, Input, type Position, type Root } from 'postcss';

import type { Span } from './templates.ts';

/** A root and the source span of its template body. */
export interface Placed {
  root: Root;
  start: number;
  end: number;
}

/** Every root's span, and the backslashes postcss-lit drops from them. */
export interface Layout {
  placed: Placed[];
  dropped: number[];
}

/** Offsets of the backslashes postcss-lit drops when it reads each `\\` in `strings` as `\`. */
export function droppedBackslashes(source: string, strings: Span[]): number[] {
  const out: number[] = [];

  for (const { start, end } of strings) {
    for (let i = start; i < end - 1; i++) {
      if (source[i] === '\\' && source[i + 1] === '\\') out.push(++i);
    }
  }

  return out.sort((a, b) => a - b);
}

/** Sets every node's offset, line and column from its place in the file. */
export function relocate(
  doc: Document,
  source: string,
  { placed, dropped }: Layout,
): void {
  const input = new Input(source);
  const bom = input.hasBOM ? 1 : 0;

  const place = (position: Position, offset: number) => {
    const at = input.fromOffset(offset - bom);

    if (!at) return;
    position.line = at.line;
    position.column = at.col;
  };

  for (const root of doc.nodes) {
    const span = placed.find((p) => p.root === root);

    const drops = span
      ? dropped.filter((offset) => span.start <= offset && offset < span.end)
      : [];

    // postcss-lit's offsets skip the dropped backslashes before them
    const real = (offset: number) => {
      let out = offset;

      for (const drop of drops) {
        if (drop > out) break;
        out++;
      }

      return out;
    };

    const relocateNode = ({ source: at }: Root | Root['nodes'][number]) => {
      // postcss end positions are inclusive, their offsets exclusive
      if (at?.start) {
        at.start.offset = real(at.start.offset);
        place(at.start, at.start.offset);
      }

      if (at?.end) {
        at.end.offset = real(at.end.offset);
        place(at.end, at.end.offset - 1);
      }
    };

    relocateNode(root);
    root.walk(relocateNode);
  }
}
