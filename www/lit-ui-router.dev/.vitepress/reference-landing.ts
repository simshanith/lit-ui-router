import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import MarkdownIt from 'markdown-it';
import type { Plugin } from 'vite';

import {
  API_REFERENCES,
  FEATURED_EXPORTS,
  type FeaturedExport,
} from '../catalog/references.ts';
import { PACKAGES, type PackageName } from '../catalog/packages.ts';
import { code } from './index-markdown.ts';

type Token = ReturnType<MarkdownIt['parse']>[number];

/** Reads a page an index entry links, or `undefined` when there is none. */
export type ReadPage = (path: string) => string | undefined;

// html on: typedoc writes inline HTML such as <code>&lt;ui-view&gt;</code>, which goes back out as HTML.
const md = new MarkdownIt({ html: true });

// typedoc-plugin-markdown's source line, between a signature and its comment.
const SOURCE_LINE = 'Defined in: ';

// An overloaded function keeps its comment under the first of these headings.
const OVERLOAD_HEADING = 'Call Signature';

const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|cf)$/i;

/** The index just past a text's first sentence end, or -1; `last` when a line break or nothing follows the text. */
function sentenceEnd(text: string, last: boolean): number {
  for (const { index } of text.matchAll(/[.!?](?=\s|$)/g)) {
    const end = index + 1;

    if (end === text.length && !last) continue;

    if (!ABBREVIATION.test(text.slice(0, index))) return end;
  }

  return -1;
}

const escapeText = (text: string): string =>
  text
    .replace(/[\\`*_[\]]/g, '\\$&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // VitePress compiles the page as a Vue template.
    .replace(/\{/g, '&#123;');

const codeSpan = (content: string, markup: string): string => {
  const pad = /^`|`$/.test(content) ? ' ' : '';

  return `${markup}${pad}${content}${pad}${markup}`;
};

// typedoc-plugin-markdown escapes the backticks of a {@link X | `X`} label, so the label arrives as text.
const CODE_LABEL = /^`([^`]+)`$/;

/** An inline token as Markdown; a link or an image keeps only its text. */
function inlineMarkdown({ type, content, markup }: Token): string {
  if (type === 'text') {
    const label = CODE_LABEL.exec(content);

    return label ? codeSpan(label[1], '`') : escapeText(content);
  }

  if (type === 'code_inline') return codeSpan(content, markup);

  if (type === 'html_inline') return content;

  if (type === 'softbreak' || type === 'hardbreak') return ' ';

  return type.startsWith('link_') || type === 'image' ? '' : markup;
}

/** How a token changes the nesting a sentence must not be cut inside. */
function nesting({ type, content, nesting: change }: Token): number {
  if (type !== 'html_inline') return change;

  if (content.startsWith('</')) return -1;

  return content.endsWith('/>') ? 0 : 1;
}

/** A paragraph's first sentence, or the whole paragraph when no sentence ends outside emphasis, links and inline HTML. */
function firstSentence(tokens: readonly Token[]): string {
  const out: string[] = [];
  let depth = 0;

  for (const [i, token] of tokens.entries()) {
    if (token.type === 'text' && depth === 0) {
      const next = tokens.at(i + 1);

      const end = sentenceEnd(
        token.content,
        !next || next.type === 'softbreak' || next.type === 'hardbreak',
      );

      if (end >= 0)
        return out.join('') + escapeText(token.content.slice(0, end));
    }

    depth += nesting(token);
    out.push(inlineMarkdown(token));
  }

  // A paragraph that only introduces the block below it ends in a colon.
  return out.join('').trim().replace(/:$/, '.');
}

/** The first sentence of a typedoc page's doc comment, as Markdown without links; `undefined` when the page has no comment. */
export function summaryOf(page: string): string | undefined {
  const tokens = md.parse(page, {});

  const title = tokens.findIndex(
    ({ type, tag }) => type === 'heading_open' && tag === 'h1',
  );

  if (title < 0) return undefined;

  // Top-level blocks only: a signature is a fence or a block quote, and neither is the comment.
  for (let i = title + 3; i < tokens.length; i++) {
    const { type, level } = tokens[i];
    const inline = tokens.at(i + 1);

    if (level !== 0 || !inline) continue;

    if (type === 'heading_open' && inline.content !== OVERLOAD_HEADING)
      return undefined;

    if (type === 'paragraph_open' && !inline.content.startsWith(SOURCE_LINE))
      return firstSentence(inline.children ?? []) || undefined;
  }

  return undefined;
}

/** The file an entry links: the plugin's category and kind lists link `./name` without the extension. */
const pageFile = (path: string): string =>
  path.endsWith('.md') ? path : `${path}.md`;

/** Reads a linked page from disk. */
export const readPage: ReadPage = (path) => {
  const file = pageFile(path);

  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

// A list item that is one link to a page: typedoc-plugin-markdown's index entries, and the plugin's category and kind lists.
const ENTRY = /^- \[(.+)\]\(([^()\s#]+)\)$/gm;

/** Each index entry followed by its page's summary; an entry whose page has none keeps its name alone. */
export function withSummaries(
  markdown: string,
  dir: string,
  read: ReadPage = readPage,
): string {
  return markdown.replace(ENTRY, (entry, _name, target: string) => {
    const page = read(join(dir, target));
    const summary = page === undefined ? undefined : summaryOf(page);

    return summary ? `${entry} — ${summary}` : entry;
  });
}

/** The line a package's reference index opens with: the way back to its package page. */
export const packageLine = (name: PackageName): string =>
  `The API reference of the [${code(name)} package](/packages/${name}), whose page covers installation and usage.`;

/** A section of the featured exports the index lists, each linking the page its own entry links; a name the index lacks is left out. */
export function startHere(
  markdown: string,
  featured: readonly FeaturedExport[],
): string {
  const targets = new Map(
    Array.from(markdown.matchAll(ENTRY), ([, name, target]) => [name, target]),
  );

  const entries = featured.flatMap(({ name, element }) => {
    const target = targets.get(name);
    const label = element ? `${code(`<${element}>`)} (${name})` : name;

    return target ? [`- [${label}](${target})`] : [];
  });

  return entries.length > 0 ? `\n\n## Start here\n\n${entries.join('\n')}` : '';
}

const featuredExports: Partial<Record<PackageName, readonly FeaturedExport[]>> =
  FEATURED_EXPORTS;

/** The package whose reference index a page path is, if any. */
export const referenceRoot = (id: string): PackageName | undefined =>
  PACKAGES.find(({ name }) => {
    const reference = API_REFERENCES[name];

    return reference !== null && id.endsWith(`${reference}index.md`);
  })?.name;

/** A generated reference index page: summaries on its entries, and on a package's root index the package link and its featured exports. */
export function referenceLanding(
  markdown: string,
  id: string,
  read: ReadPage = readPage,
): string {
  const name = referenceRoot(id);

  const intro =
    name &&
    packageLine(name) + startHere(markdown, featuredExports[name] ?? []);

  const page = intro
    ? markdown.replace(/^# .+$/m, (title) => `${title}\n\n${intro}`)
    : markdown;

  return withSummaries(page, dirname(id), read);
}

/** Rewrites each generated reference index before VitePress and the llms plugin read it; local search reads the file from disk, so the summaries stay out of its index. */
export function referenceLandingPlugin(): Plugin {
  return {
    name: 'reference-landing',
    enforce: 'pre',
    transform: {
      filter: { id: /\/reference\/[^/]+\/(?:.+\/)?index\.md$/ },
      handler(markdown, id) {
        const page = referenceLanding(markdown, id, (path) => {
          this.addWatchFile(pageFile(path));

          return readPage(path);
        });

        return page === markdown ? null : { code: page, map: null };
      },
    },
  };
}
