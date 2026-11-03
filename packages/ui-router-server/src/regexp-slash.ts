/** Whether a regexp source may match a `/`, for the route trie and URLPattern routes. */

// An escape, a character class, or one source character.
const atom =
  /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|c[a-zA-Z]|[\s\S])|\[(?:\\[\s\S]|[^\\\]])*\]|[\s\S]/g;

// Numeric escapes are backreferences or legacy octals (\057 is '/'): refuse them unread.
const opaqueEscape = /^\\[\dk]/;

const atomMatchesSlash = (token: string): boolean => {
  if (token.length === 1) return token === '/' || token === '.';

  if (opaqueEscape.test(token)) return true;

  return new RegExp(`^(?:${token})$`).test('/');
};

/**
 * True when a regexp source may consume a `/` or close a group it didn't open; never a false negative.
 *
 * @internal
 */
export const mayMatchSlash = (source: string): boolean => {
  let depth = 0;

  for (const token of source.match(atom) ?? []) {
    if (token === '(') depth++;

    if (token === ')') depth--;

    if (depth < 0 || atomMatchesSlash(token)) return true;
  }

  return depth !== 0;
};
