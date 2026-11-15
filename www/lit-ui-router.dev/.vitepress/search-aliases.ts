import { tokenizeSearchText } from 'vitepress/dist/client/shared.js';

import { SEARCH_ALIASES } from '../catalog/search-aliases.ts';

/** Names local search treats as one: where a member appears, the index also holds every other member. */
export type SearchAliasGroup = readonly [string, string, ...string[]];

type Phrase = readonly string[];

const GROUPS: readonly (readonly Phrase[])[] = (
  SEARCH_ALIASES satisfies readonly SearchAliasGroup[]
).map((group) =>
  group.map((member) => tokenizeSearchText(member.toLowerCase())),
);

const HEADING_RE = /(<h[1-6][\s>][\s\S]*?<\/h[1-6]>)/i;

function startsAt(terms: readonly string[], at: number, phrase: Phrase) {
  for (let i = 0; i < phrase.length; i++)
    if (terms[at + i] !== phrase[i]) return false;

  return true;
}

/** The other members' terms for each mention of a group member in `text`, so aliases keep the term's frequency. */
export function aliasesIn(text: string): string[] {
  const terms = tokenizeSearchText(text).map((term) => term.toLowerCase());
  const aliases: string[] = [];

  for (let at = 0; at < terms.length; at++) {
    for (const group of GROUPS) {
      const found = group.find((phrase) => startsAt(terms, at, phrase));

      if (!found) continue;

      for (const phrase of group)
        if (phrase !== found) for (const term of phrase) aliases.push(term);
    }
  }

  return aliases;
}

function aliasText(html: string) {
  const aliases = aliasesIn(html.replace(/<[^>]*>/g, ' '));

  return aliases.length ? `\n${aliases.join(' ')}\n` : '';
}

/**
 * Appends each section's aliases to its body in the HTML local search indexes.
 * Build-time only: a `miniSearch` tokenizer would ship to the client without its module scope.
 */
export function withSearchAliases(html: string): string {
  const parts = html.split(HEADING_RE);

  for (let i = 2; i < parts.length; i += 2)
    parts[i] += aliasText(parts[i - 1] + parts[i]);

  return parts.join('');
}
