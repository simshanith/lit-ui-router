import { Window, type Document } from 'happy-dom';

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

function annotate(document: Document, html: string) {
  const root = document.createElement('div');

  root.innerHTML = html;

  if (!aliasesIn(root.textContent).length) return html;

  const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const range = document.createRange();

  headings.forEach((heading, i) => {
    const next = headings[i + 1];

    range.setStartBefore(heading);

    if (next) range.setEndBefore(next);
    else range.setEndAfter(root.lastChild ?? heading);

    const aliases = aliasesIn(range.toString());

    if (!aliases.length) return;

    const text = document.createTextNode(`\n${aliases.join(' ')}\n`);

    if (next) next.before(text);
    else root.append(text);
  });

  return root.innerHTML;
}
