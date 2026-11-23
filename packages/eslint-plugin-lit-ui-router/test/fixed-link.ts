// parse5 reads a fixed template the way a browser does, without
// eslint-plugin-lit's quoting of bare placeholders, which hides a value that
// runs into the next attribute.
import assert from 'node:assert/strict';
import tsParser from '@tools/eslint-ts-parser';
import { Linter, type Rule } from 'eslint';
import { ErrorCodes, parseFragment } from 'parse5';

const linter = new Linter();

/** The raw quasis of the first tagged template in `code`. */
const firstTemplate = (code: string): string[] | undefined => {
  let quasis: string[] | undefined;

  const capture: Rule.RuleModule = {
    create: () => ({
      TaggedTemplateExpression(node) {
        quasis ??= node.quasi.quasis.map(({ value }) => value.raw);
      },
    }),
  };

  const messages = linter.verify(code, {
    languageOptions: { parser: tsParser, sourceType: 'module' },
    plugins: { test: { rules: { capture } } },
    rules: { 'test/capture': 'error' },
  });

  assert.deepEqual(messages, [], code);

  return quasis;
};

/** Each expression's spot in an attribute value, as `attributes` spells it. */
const EXPRESSION = '${}';

/**
 * Assert the first element of the first tagged template in `code` parses with
 * exactly `attributes`, in order: none swallowed into a neighbour's value, and
 * a single `aria-current`.
 */
export const assertFixedLink = (
  code: string,
  attributes: Record<string, string>,
): void => {
  const quasis = firstTemplate(code);

  assert.ok(quasis, 'no tagged template in the fixed output');

  const html = quasis
    .map((raw, index) => (index === 0 ? raw : `__expr${index - 1}__${raw}`))
    .join('');

  // parse5 drops a repeated attribute silently, so the parse error is the check.
  const duplicates: string[] = [];

  const element = parseFragment(html, {
    onParseError: ({ code: error }) => {
      if (error === ErrorCodes.duplicateAttribute) duplicates.push(error);
    },
  }).childNodes.find((child) => 'attrs' in child);

  assert.deepEqual(duplicates, [], html);

  assert.ok(element !== undefined && 'attrs' in element, html);

  const parsed = Object.fromEntries(
    element.attrs.map(({ name, value }) => [
      name,
      value.replaceAll(/__expr\d+__/g, EXPRESSION),
    ]),
  );

  assert.deepEqual(Object.entries(parsed), Object.entries(attributes), html);
};
