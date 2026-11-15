import { Element, Text, Window, type Document, type Node } from 'happy-dom';

import { SEARCH_ALIASES } from '../catalog/search-aliases.ts';

/** Names local search treats as one: where a member appears, the index also holds every other member. */
export type SearchAliasGroup = readonly [string, string, ...string[]];

type Phrase = readonly string[];

/** Lowercase letter and digit runs: matches `<ui-view>` and `ui-view` alike, before VitePress tokenizes the index. */
function terms(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

const GROUPS: readonly (readonly Phrase[])[] = (
  SEARCH_ALIASES satisfies readonly SearchAliasGroup[]
).map((group) => group.map((member) => terms(member)));

function startsAt(terms: readonly string[], at: number, phrase: Phrase) {
  for (let i = 0; i < phrase.length; i++)
    if (terms[at + i] !== phrase[i]) return false;

  return true;
}

/** The other members' terms for each mention of a group member in `text`, so aliases keep the term's frequency. */
export function aliasesIn(text: string): string[] {
  const words = terms(text);
  const aliases: string[] = [];

  for (let at = 0; at < words.length; at++) {
    for (const group of GROUPS) {
      const found = group.find((phrase) => startsAt(words, at, phrase));

      if (!found) continue;

      for (const phrase of group)
        if (phrase !== found) for (const term of phrase) aliases.push(term);
    }
  }

  return aliases;
}

/**
 * Appends each section's aliases to its body in the HTML local search indexes.
 * Build-time only: a `miniSearch` tokenizer would ship to the client without its module scope.
 */
export async function withSearchAliases(html: string): Promise<string> {
  const window = new Window();

  try {
    return annotate(window.document, html);
  } finally {
    await window.happyDOM.close();
  }
}

const HEADING = /^H[1-6]$/;

interface Section {
  heading: Element;
  text: string[];
}

/** One pass in document order: each text node joins the section of the heading before it. */
function collect(node: Node, sections: Section[]) {
  for (const child of node.childNodes) {
    if (child instanceof Text) {
      sections.at(-1)?.text.push(child.data);
      continue;
    }

    if (!(child instanceof Element)) continue;

    if (HEADING.test(child.tagName))
      sections.push({ heading: child, text: [] });

    collect(child, sections);
  }
}

function annotate(document: Document, html: string) {
  const root = document.createElement('div');

  root.innerHTML = html;

  if (!aliasesIn(root.textContent).length) return html;

  const sections: Section[] = [];

  collect(root, sections);

  sections.forEach(({ text }, i) => {
    const aliases = aliasesIn(text.join(''));

    if (!aliases.length) return;

    const node = document.createTextNode(`\n${aliases.join(' ')}\n`);
    const next = sections[i + 1]?.heading;

    if (next) next.before(node);
    else root.append(node);
  });

  return root.innerHTML;
}
