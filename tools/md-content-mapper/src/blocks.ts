import MarkdownIt from 'markdown-it';

/** Fence languages this mapper type-checks. */
export const CHECKED_LANGS: ReadonlySet<string> = new Set(['ts', 'typescript']);

/** Fence meta word that opts a block out of the check. */
export const SKIP_FLAG = 'nocheck';

export type SkipReason = 'nocheck' | 'empty';

export interface CodeBlock {
  lang: string;
  meta: string;
  /** 1-based Markdown lines of the opening and closing fences. */
  line: number;
  endLine: number;
  text: string;
  /** Verbatim spans: [virtualStart, length, originalStart], UTF-16 offsets. */
  spans: [number, number, number][];
  skip?: SkipReason;
}

const md = new MarkdownIt();

const lineStarts = (source: string): number[] => {
  const starts = [0];

  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) starts.push(i + 1);
  }

  return starts;
};

const parseInfo = (info: string): { lang: string; meta: string } => {
  const match = /^([\w-]+)(.*)$/s.exec(info.trim());

  return match
    ? { lang: match[1].toLowerCase(), meta: match[2].trim() }
    : { lang: '', meta: '' };
};

const hasSkipFlag = (meta: string): boolean =>
  meta
    .replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .includes(SKIP_FLAG);

/** Map each content line to the source line it was copied from, minus the container indent markdown-it stripped. */
const mapLines = (
  source: string,
  starts: number[],
  firstLine: number,
  content: string,
): [number, number, number][] => {
  const spans: [number, number, number][] = [];
  let virtual = 0;

  for (const [i, line] of content.split('\n').entries()) {
    const sourceIndex = firstLine + i;
    const start = starts[sourceIndex];

    if (start !== undefined && line.length > 0) {
      const end = (starts[sourceIndex + 1] ?? source.length + 1) - 1;
      const sourceLine = source.slice(start, end).replace(/\r$/, '');

      if (sourceLine.endsWith(line)) {
        spans.push([
          virtual,
          line.length,
          start + sourceLine.length - line.length,
        ]);
      }
    }

    virtual += line.length + 1;
  }

  return spans;
};

export const extractBlocks = (source: string): CodeBlock[] => {
  const starts = lineStarts(source);
  const blocks: CodeBlock[] = [];

  for (const token of md.parse(source, {})) {
    if (token.type !== 'fence' || !token.map) continue;

    const { lang, meta } = parseInfo(token.info);

    if (!CHECKED_LANGS.has(lang)) continue;

    const block: CodeBlock = {
      lang,
      meta,
      line: token.map[0] + 1,
      endLine: token.map[1],
      text: token.content,
      spans: mapLines(source, starts, token.map[0] + 1, token.content),
    };

    if (hasSkipFlag(meta)) block.skip = 'nocheck';
    else if (token.content.trim() === '') block.skip = 'empty';

    blocks.push(block);
  }

  return blocks;
};
