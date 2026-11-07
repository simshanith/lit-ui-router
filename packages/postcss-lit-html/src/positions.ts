import type { Document, Position, Root } from 'postcss';

/**
 * Sets every node's line and column from its offset in the file. postcss-lit
 * offsets are exact, but its columns on a template's first line count from the
 * template's start.
 */
export function relocate(doc: Document | Root, source: string): void {
  const starts = [0];

  for (let i = source.indexOf('\n'); i >= 0; i = source.indexOf('\n', i + 1)) {
    starts.push(i + 1);
  }

  const place = (position: Position | undefined, offset: number) => {
    if (!position) return;
    let low = 0;
    let high = starts.length - 1;

    while (low < high) {
      const mid = (low + high + 1) >> 1;

      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }

    position.line = low + 1;
    position.column = offset - starts[low] + 1;
  };

  doc.walk((node) => {
    const { start, end } = node.source ?? {};

    // postcss end positions are inclusive, their offsets exclusive
    if (start) place(start, start.offset);

    if (end) place(end, end.offset - 1);
  });
}
