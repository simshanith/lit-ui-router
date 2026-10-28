import type { DefaultTheme, MarkdownEnv } from 'vitepress';

type SearchRender = NonNullable<DefaultTheme.LocalSearchOptions['_render']>;

type Markdown = Parameters<SearchRender>[2];

type Token = ReturnType<Markdown['parse']>[number];

// typedoc-plugin-markdown sub-section labels; their content joins the member above.
const MERGED = new Set([
  'Call Signature',
  'Extended by',
  'Extends',
  'Get Signature',
  'Implements',
  'Parameters',
  'Returns',
  'Set Signature',
  'Type Parameters',
]);

// Link-only pointers at the declaring or overridden member.
const DROPPED = new Set(['Implementation of', 'Inherited from', 'Overrides']);

const DROPPED_COLUMNS = new Set(['Defined in', 'Inherited from', 'Overrides']);

// Source locations and re-export pointers.
const GENERATED_LINE = /^(Defined in:|Re-exports|Renames and re-exports) /;

// typedoc-vitepress-theme writes each package under api/<package>/; api/index.md is authored.
const TYPEDOC_PAGE = /^api\/[^/]+\//;

interface Heading {
  open: number;
  level: number;
  title: string;
  /** Index of the next heading_open, or tokens.length. */
  next: number;
}

interface Section {
  n: number;
  merged: number[];
}

function dropRange(drop: Set<number>, from: number, to: number): void {
  for (let i = from; i < to; i++) drop.add(i);
}

function headingsOf(tokens: Token[]): Heading[] {
  const opens = tokens.flatMap((t, i) =>
    t.type === 'heading_open' ? [i] : [],
  );

  return opens.map((open, n) => ({
    open,
    level: Number(tokens[open].tag.slice(1)),
    title: tokens[open + 1].content,
    next: opens[n + 1] ?? tokens.length,
  }));
}

/** End of a heading's subtree: the next heading at its level or above. */
function subtreeEnd(headings: Heading[], n: number, length: number): number {
  const { level } = headings[n];

  return headings.slice(n + 1).find((h) => h.level <= level)?.open ?? length;
}

/** The member an "Inherited from" label belongs to. */
function memberOf(headings: Heading[], n: number): number {
  for (let m = n - 1; m >= 0; m--) {
    if (headings[m].level < headings[n].level && !MERGED.has(headings[m].title))
      return m;
  }

  return -1;
}

/** Whether the member a signature fence opens also lists its parameters or return type. */
function restatedBelow(headings: Heading[], n: number): boolean {
  for (const h of headings.slice(n + 1)) {
    if (h.title === 'Parameters' || h.title === 'Returns') return true;

    if (!MERGED.has(h.title) && !DROPPED.has(h.title)) return false;
  }

  return false;
}

/** Each row's tr_open and tr_close, and the open token of each of its cells. */
function rowsOf(tokens: Token[], start: number, end: number) {
  const rows: { open: number; close: number; cells: number[] }[] = [];

  for (let i = start; i < end; i++) {
    const { type } = tokens[i];

    if (type === 'tr_open') rows.push({ open: i, close: i, cells: [] });
    else if (type === 'th_open' || type === 'td_open')
      rows[rows.length - 1].cells.push(i);
    else if (type === 'tr_close') rows[rows.length - 1].close = i;
  }

  return rows;
}

/** Drops source-link columns and inherited rows from a table; returns its table_close index. */
function trimTable(tokens: Token[], start: number, drop: Set<number>): number {
  let end = start;

  while (tokens[end].type !== 'table_close') end++;
  const [header, ...body] = rowsOf(tokens, start, end);
  const names = header.cells.map((cell) => tokens[cell + 1].content);
  const inherited = names.indexOf('Inherited from');

  const isInherited = (row: (typeof body)[number]) =>
    inherited >= 0 &&
    !['', '-'].includes(tokens[row.cells[inherited] + 1].content);

  for (const row of [header, ...body]) {
    for (const [k, cell] of row.cells.entries()) {
      if (DROPPED_COLUMNS.has(names[k])) dropRange(drop, cell, cell + 3);
    }
  }

  const own = body.filter((row) => !isInherited(row));

  for (const row of body) {
    if (isInherited(row)) dropRange(drop, row.open, row.close + 1);
  }

  if (body.length && !own.length) dropRange(drop, start, end + 1);

  return end;
}

/** Marks source links, re-export pointers, inherited copies and restated signatures. */
function markGenerated(
  tokens: Token[],
  headings: Heading[],
  drop: Set<number>,
): void {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === 'table_open') i = trimTable(tokens, i, drop);
    else if (
      t.type === 'inline' &&
      tokens[i - 1]?.type === 'paragraph_open' &&
      GENERATED_LINE.test(t.content)
    ) {
      dropRange(drop, i - 1, i + 2);
    }
  }

  for (const [n, h] of headings.entries()) {
    if (DROPPED.has(h.title)) {
      dropRange(drop, h.open, h.next);
      const member = h.title === 'Inherited from' ? memberOf(headings, n) : -1;

      if (member >= 0)
        dropRange(
          drop,
          headings[member].open,
          subtreeEnd(headings, member, tokens.length),
        );
    } else if (
      tokens[h.open + 3]?.type === 'fence' &&
      restatedBelow(headings, n)
    ) {
      drop.add(h.open + 3);
    }
  }
}

/** Whether a heading opens a search section: it titles the page, has content, or a signature below. */
function opensSection(
  tokens: Token[],
  headings: Heading[],
  n: number,
  drop: Set<number>,
): boolean {
  const h = headings[n];
  const next = headings[n + 1];

  if (h.level === 1 || (next && next.level > h.level && MERGED.has(next.title)))
    return true;

  for (let i = h.open + 3; i < h.next; i++) {
    if (!drop.has(i) && tokens[i].type !== 'hr') return true;
  }

  return false;
}

/** Kept headings in page order, each with the merged labels whose content it takes. */
function sectionsOf(
  tokens: Token[],
  headings: Heading[],
  drop: Set<number>,
): Section[] {
  const sections: Section[] = [];
  const ancestors: { level: number; section?: Section }[] = [];

  for (const [n, h] of headings.entries()) {
    while (ancestors.length && ancestors[ancestors.length - 1].level >= h.level)
      ancestors.pop();

    if (drop.has(h.open)) continue;

    const owner = ancestors.reduce<Section | undefined>(
      (found, a) => a.section ?? found,
      undefined,
    );

    let section: Section | undefined;

    if (MERGED.has(h.title) && owner) {
      owner.merged.push(n);
    } else if (opensSection(tokens, headings, n, drop)) {
      const next = headings[n + 1];

      if (h.next === h.open + 3 && next && MERGED.has(next.title)) {
        // The modal excerpts the page between a heading and the next one, so
        // point an empty member heading at the signature section below it.
        const anchor = tokens[h.open + 1].children?.find(
          (c) => c.attrGet('class') === 'header-anchor',
        );

        anchor?.attrSet('href', `#${tokens[next.open].attrGet('id')}`);
      }

      // Lift past removed ancestors so the search breadcrumbs stay contiguous.
      const lift = ancestors.filter((a) => !a.section).length;
      tokens[h.open].tag = tokens[h.open + 2].tag = `h${h.level - lift}`;
      section = { n, merged: [] };
      sections.push(section);
    }

    ancestors.push({ level: h.level, section });
  }

  return sections;
}

/**
 * Trims typedoc's generated repetition from a parsed API page, keeping the
 * authored prose: signature blocks the parameter and return tables restate,
 * "Defined in" source links, inherited-member copies, link-only override
 * notes, and headings with no content of their own.
 */
export function trimApiTokens(tokens: Token[]): Token[] {
  const headings = headingsOf(tokens);
  const drop = new Set<number>();
  markGenerated(tokens, headings, drop);

  const content = (n: number) =>
    tokens
      .slice(headings[n].open + 3, headings[n].next)
      .filter((_, i) => !drop.has(headings[n].open + 3 + i));

  const out = tokens.slice(0, headings[0]?.open ?? tokens.length);

  for (const { n, merged } of sectionsOf(tokens, headings, drop)) {
    out.push(
      ...tokens.slice(headings[n].open, headings[n].open + 3),
      ...content(n),
    );

    for (const m of merged) out.push(...content(m));
  }

  return out;
}

/** Local search `_render`: typedoc pages are indexed without their generated repetition. */
export const renderForSearch: SearchRender = async (
  src: string,
  env: MarkdownEnv,
  md: Markdown,
) => {
  if (!TYPEDOC_PAGE.test(env.relativePath)) {
    const html = await md.renderAsync(src, env);

    return env.frontmatter?.search === false ? '' : html;
  }

  const tokens = md.parse(src, env);

  if (env.frontmatter?.search === false) return '';

  // Index text only: skip the async highlighter, which needs renderAsync's placeholder pass.
  return md.renderer.render(
    trimApiTokens(tokens),
    { ...md.options, highlight: null },
    env,
  );
};
