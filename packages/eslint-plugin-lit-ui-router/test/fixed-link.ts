// parse5 reads a fixed template the way a browser does, without
// eslint-plugin-lit's quoting of bare placeholders, which hides a value that
// runs into the next attribute.
import assert from 'node:assert/strict';
import tsParser from '@tools/eslint-ts-parser';
import { parseFragment } from 'parse5';

interface AstNode {
  type: string;
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- a walk over untyped AST children
  [key: string]: unknown;
}

interface Quasi {
  value: { raw: string };
}

const isAstNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string';

/** The quasis of the first tagged template in `node`, depth first. */
const firstTemplate = (node: AstNode): Quasi[] | undefined => {
  if (node.type === 'TaggedTemplateExpression') {
    // SAFETY: a TaggedTemplateExpression always carries a TemplateLiteral quasi
    return (node.quasi as { quasis: Quasi[] }).quasis;
  }

  for (const [key, child] of Object.entries(node)) {
    if (key === 'parent') continue;

    for (const item of Array.isArray(child) ? child : [child]) {
      if (!isAstNode(item)) continue;
      const found = firstTemplate(item);

      if (found !== undefined) return found;
    }
  }

  return undefined;
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
  const program: unknown = tsParser.parse(code, { sourceType: 'module' });

  assert.ok(isAstNode(program));
  const quasis = firstTemplate(program);

  assert.ok(quasis, 'no tagged template in the fixed output');

  const html = quasis
    .map(({ value }, index) =>
      index === 0 ? value.raw : `__expr${index - 1}__${value.raw}`,
    )
    .join('');

  const element = parseFragment(html).childNodes.find(
    (child) => 'attrs' in child,
  );

  assert.ok(element !== undefined && 'attrs' in element, html);

  const parsed = Object.fromEntries(
    element.attrs.map(({ name, value }) => [
      name,
      value.replaceAll(/__expr\d+__/g, EXPRESSION),
    ]),
  );

  assert.deepEqual(Object.entries(parsed), Object.entries(attributes), html);
};
