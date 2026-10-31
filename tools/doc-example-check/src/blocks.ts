/** Fence languages this tool type-checks. */
export const CHECKED_LANGS: ReadonlySet<string> = new Set(['ts', 'typescript']);

/** Info-string word that opts a block in, as in the Markdown checker. */
export const CHECK_FLAG = 'check';

/** Info-string word that opts a block out, as in the Markdown checker. */
export const SKIP_FLAG = 'nocheck';

export type Mode = 'opt-in' | 'opt-out';

export type SkipReason = 'unflagged' | 'nocheck' | 'empty';

/** A source position: 1-based line, 0-based UTF-16 column. */
export interface SourcePosition {
  line: number;
  column: number;
}

export interface ExampleBlock {
  lang: string;
  meta: string;
  /** 1-based source lines of the opening and closing fences. */
  line: number;
  endLine: number;
  text: string;
  /** Source position of each text line's first character. */
  lines: SourcePosition[];
  skip?: SkipReason;
}

export interface CommentLine extends SourcePosition {
  text: string;
}

// leading indent, the `*` gutter and one space; `/**` openers are left to the caller's range
const GUTTER = /^[ \t]*\*(?!\/)[ \t]?/;

/**
 * The lines of `source` in `[start, end)` with each doc-comment gutter stripped,
 * stopping at the comment's closing `*\/`.
 */
export const commentLines = (
  source: string,
  start: number,
  end: number,
): CommentLine[] => {
  const lines: CommentLine[] = [];
  let lineStart = source.lastIndexOf('\n', start - 1) + 1;
  let line = source.slice(0, lineStart).split('\n').length;

  while (lineStart < end) {
    const newline = source.indexOf('\n', lineStart);
    const lineEnd = Math.min(newline === -1 ? source.length : newline, end);
    const from = Math.max(lineStart, start);
    let text = source.slice(from, lineEnd).replace(/\r$/, '');
    let column = from - lineStart;

    if (from === lineStart) {
      const gutter = GUTTER.exec(text)?.[0] ?? '';

      text = text.slice(gutter.length);
      column += gutter.length;
    }

    const close = text.indexOf('*/');

    lines.push({
      line,
      column,
      text: close === -1 ? text : text.slice(0, close).trimEnd(),
    });

    if (close !== -1 || newline === -1) break;

    lineStart = newline + 1;
    line += 1;
  }

  return lines;
};

const FENCE = /^(`{3,}|~{3,})(.*)$/;

const parseInfo = (info: string): { lang: string; meta: string } => {
  const match = /^([\w-]+)(.*)$/s.exec(info.trim());

  return match
    ? { lang: match[1].toLowerCase(), meta: match[2].trim() }
    : { lang: '', meta: '' };
};

const metaWords = (meta: string): string[] =>
  meta.replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ').split(/\s+/);

const skipReason = (
  meta: string,
  text: string,
  mode: Mode,
): SkipReason | undefined => {
  const words = metaWords(meta);

  if (text.trim() === '') return 'empty';

  if (words.includes(SKIP_FLAG)) return 'nocheck';

  return mode === 'opt-in' && !words.includes(CHECK_FLAG)
    ? 'unflagged'
    : undefined;
};

interface OpenFence {
  marker: string;
  lang: string;
  meta: string;
  line: number;
  indent: number;
  body: CommentLine[];
}

const closeFence = (
  open: OpenFence,
  endLine: number,
  mode: Mode,
): ExampleBlock => {
  const body = open.body.map((entry) => {
    const indent = Math.min(open.indent, /^[ \t]*/.exec(entry.text)![0].length);

    return {
      text: entry.text.slice(indent),
      line: entry.line,
      column: entry.column + indent,
    };
  });

  const text = body.map((entry) => `${entry.text}\n`).join('');

  const block: ExampleBlock = {
    lang: open.lang,
    meta: open.meta,
    line: open.line,
    endLine,
    text,
    lines: body.map(({ line, column }) => ({ line, column })),
  };

  const skip = skipReason(open.meta, text, mode);

  if (skip) block.skip = skip;

  return block;
};

export interface TagFences {
  blocks: ExampleBlock[];
  /** Whether the tag holds any fence, in any language. */
  fenced: boolean;
}

/** The ts blocks fenced inside one `@example` tag's comment lines. */
export const extractFences = (lines: CommentLine[], mode: Mode): TagFences => {
  const blocks: ExampleBlock[] = [];
  let open: OpenFence | undefined;
  let fenced = false;

  for (const entry of lines) {
    const indent = /^[ \t]*/.exec(entry.text)![0].length;
    const match = FENCE.exec(entry.text.slice(indent));

    if (open) {
      if (match?.[1].startsWith(open.marker) && match[2].trim() === '') {
        if (CHECKED_LANGS.has(open.lang)) {
          blocks.push(closeFence(open, entry.line, mode));
        }

        open = undefined;
      } else {
        open.body.push(entry);
      }

      continue;
    }

    if (!match) continue;

    fenced = true;
    open = {
      marker: match[1],
      ...parseInfo(match[2]),
      line: entry.line,
      indent,
      body: [],
    };
  }

  return { blocks, fenced };
};
