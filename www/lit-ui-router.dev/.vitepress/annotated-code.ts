// A code listing with marked regions: each region becomes <mark> elements in the site highlighter's own output, one per line it covers.
import type { MarkdownOptions, MarkdownRenderer } from 'vitepress';

import type { Position } from '../catalog/home-sample.ts';

type CodeTransformer = NonNullable<MarkdownOptions['codeTransformers']>[number];

/** The span of a listing a region marks, by its first and last character. */
export interface RegionRange {
  id: string;
  start: Position;
  end: Position;
}

/** One line's share of a region: columns counted from 1, the last one included. */
export interface RegionPart {
  id: string;
  line: number;
  from: number;
  to: number;
  /** Where the line sits in its region, so a region of several lines draws as one box. */
  part: 'only' | 'start' | 'middle' | 'end';
  /** The widest line's share of the region, in characters. */
  span: number;
}

/** The listing a sample module shows: its source below the import block, which ends at the first blank line. */
export function listingOf(source: string): string {
  const end = source.indexOf('\n\n');

  if (end < 0)
    throw new Error('the sample has no blank line after its imports');

  return source.slice(end + 2).trimEnd();
}

const lineOf = (lines: readonly string[], line: number, id: string): string => {
  const text = lines[line - 1];

  if (text === undefined)
    throw new Error(`region ${id}: the listing has no line ${line}`);

  return text;
};

function placeOf(index: number, count: number): RegionPart['part'] {
  if (count === 1) return 'only';

  if (index === 0) return 'start';

  return index === count - 1 ? 'end' : 'middle';
}

/**
 * Each region split by line. Every part starts at the region's own start
 * column, so the parts of a region stack into a rectangle; the lines after the
 * first must be indented at least that far.
 */
export function regionParts(
  listing: string,
  regions: readonly RegionRange[],
): RegionPart[] {
  const lines = listing.split('\n');

  let after: Position = [1, 0];

  return regions.flatMap(({ id, start, end }) => {
    const [first, from] = start;
    const [last, to] = end;

    if (first < after[0] || (first === after[0] && from <= after[1]))
      throw new Error(`region ${id} starts before the region ahead of it ends`);

    if (last < first || (last === first && to < from))
      throw new Error(`region ${id} ends before it starts`);
    after = end;

    const parts = Array.from({ length: last - first + 1 }, (_, index) => {
      const line = first + index;
      const text = lineOf(lines, line, id);
      const until = line === last ? to : text.length;

      if (from < 1 || until > text.length || until < from)
        throw new Error(
          `region ${id}: line ${line} has no columns ${from} to ${until}`,
        );

      if (line > first && text.slice(0, from - 1).trim() !== '')
        throw new Error(
          `region ${id}: line ${line} has code left of column ${from}`,
        );

      return { id, line, from, to: until };
    });

    const span = Math.max(...parts.map((part) => part.to - part.from + 1));

    return parts.map((part, index): RegionPart => ({
      ...part,
      span,
      part: placeOf(index, parts.length),
    }));
  });
}

/** The text a region marks: its parts, a line each. */
export function markedText(listing: string, region: RegionRange): string {
  const lines = listing.split('\n');

  return regionParts(listing, [region])
    .map(({ line, from, to }) => lines[line - 1].slice(from - 1, to))
    .join('\n');
}

const ANNOTATE = /(?:^|\s)annotate=(\S+)/;

/**
 * Marks the regions of a fenced block whose info string names a listing, as
 * in `annotate=home-sample`. Each part is a `<mark>` carrying its region's id
 * in `data-region`, its place in the region in `data-part`, and the region's
 * width in characters in `--span`.
 */
export function annotatedCode(
  listings: Readonly<Record<string, readonly RegionRange[]>>,
): CodeTransformer {
  return {
    name: 'annotated-code',
    // Decorations are read once, before tokenising: a later hook is too late to add them.
    preprocess(code, options) {
      const name = ANNOTATE.exec(options.meta?.__raw ?? '')?.[1];

      if (!name) return;

      const regions = listings[name];

      if (!regions) throw new Error(`no annotated listing named ${name}`);

      options.decorations = [
        ...(options.decorations ?? []),
        ...regionParts(code, regions).map(
          ({ id, line, from, to, part, span }) => ({
            start: { line: line - 1, character: from - 1 },
            end: { line: line - 1, character: to },
            tagName: 'mark',
            // A part that is one token would otherwise take the mark's properties itself, and lose its colours.
            alwaysWrap: true,
            properties: {
              'data-region': id,
              'data-part': part,
              style: `--span:${span}`,
            },
          }),
        ),
      ];
    },
  };
}

/**
 * A listing highlighted by the site's renderer with its regions marked: the
 * `<pre>` alone, without the copy button and language label a fence in a page
 * is wrapped in. `annotatedCode` must be among the renderer's transformers.
 */
export async function highlightAnnotated(
  md: MarkdownRenderer,
  listing: string,
  lang: string,
  name: string,
): Promise<string> {
  const html = await md.renderAsync(
    `\`\`\`\`${lang} annotate=${name}\n${listing}\n\`\`\`\`\n`,
  );

  const start = html.indexOf('<pre');
  const end = html.lastIndexOf('</pre>');

  if (start < 0 || end < 0)
    throw new Error('the renderer returned no <pre> for the listing');

  return html.slice(start, end + '</pre>'.length);
}
