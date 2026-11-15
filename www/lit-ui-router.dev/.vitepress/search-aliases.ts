import { tokenizeSearchText } from 'vitepress/dist/client/shared.js';

/** Groups of names local search treats as one: where a member appears, the index also holds every other member. */
export const SEARCH_ALIASES = [
  ['11ty', 'eleventy'],
  ['ui-view', 'uiview'],
  ['prerender', 'ssg'],
] as const;

type Phrase = readonly string[];

const GROUPS: readonly (readonly Phrase[])[] = SEARCH_ALIASES.map((group) =>
  group.map((member) => tokenizeSearchText(member)),
);

function startsAt(terms: readonly string[], at: number, phrase: Phrase) {
  for (let i = 0; i < phrase.length; i++)
    if (terms[at + i] !== phrase[i]) return false;

  return true;
}

/** Index-time only: theme config reaches the client as JSON, so queries keep VitePress's tokenizer. */
export function tokenizeWithAliases(text: string): string[] {
  const tokens = tokenizeSearchText(text);
  const terms = tokens.map((token) => token.toLowerCase());
  const aliases: string[] = [];

  for (let at = 0; at < terms.length; at++) {
    for (const group of GROUPS) {
      const found = group.find((phrase) => startsAt(terms, at, phrase));

      if (!found) continue;

      for (const phrase of group) if (phrase !== found) aliases.push(...phrase);
    }
  }

  return aliases.length ? [...tokens, ...aliases] : tokens;
}
