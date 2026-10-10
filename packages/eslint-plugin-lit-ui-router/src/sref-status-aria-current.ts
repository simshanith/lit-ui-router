// The controller half of the aria-current trio. `SrefStatusController` hands a
// host raw status flags so `classMap` can compose them; nothing about that
// writes `aria-current`, so a link painted from `this.users.active` is active
// for CSS only, exactly the gap the srefActiveClass rule closes for directives.
import type { Rule } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  asNode,
  asNodes,
  attributeEnd,
  attributePartsOf,
  createDirectiveTracker,
  hasAriaCurrent,
  isLinkElement,
  isMemberExpression,
  LINK_ELEMENTS_SCHEMA,
  linkElementsOf,
  type Node,
  toEstree,
} from './directives.ts';

type ClassMember = Parameters<
  NonNullable<Rule.NodeListener['ClassBody']>
>[0]['body'][number];

type MethodNode = Extract<ClassMember, { type: 'MethodDefinition' }>;

type FieldNode = Extract<ClassMember, { type: 'PropertyDefinition' }>;

/** The class binding in both spellings: the attribute, and the property lit maps it to. */
const CLASS_ATTRIBUTES = new Set(['class', '.classname']);

/** The same placeholder `attributePartsOf` counts, since the property form is not a part. */
const ATTRIBUTE_PART = /\{\{__q:(\d+)__\}\}/gi;

export const RULE_NAME = 'sref-status-aria-current';

/** Whether a value off an AST node is itself a node. */
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  typeof value.type === 'string';

/** A key's name, `#`-prefixed when private; nothing for a key with no name. */
const nameOf = (key: Node): string | undefined => {
  if (typeof key.name !== 'string') return undefined;

  return key.type === 'PrivateIdentifier' ? `#${key.name}` : key.name;
};

/** The field key a controller is held under: `users`, or `#users` when private. */
const keyOf = (member: FieldNode): string | undefined =>
  member.computed ? undefined : nameOf(asNode(member.key));

/** The same key read off `this.users` / `this.#users`, or nothing. */
const thisKeyOf = (node: Node): string | undefined => {
  if (!isMemberExpression(node) || node.computed === true) return undefined;

  if (node.object.type !== 'ThisExpression') return undefined;

  return nameOf(node.property);
};

/**
 * A child key that carries a *reference*. A non-computed member property and a
 * non-computed object key are names, not reads, so `{ active: ... }` never
 * resolves `active` against the scope it happens to sit in.
 */
const isReferenceKey = (node: Node, key: string): boolean => {
  if (key === 'parent') return false;
  const computed = node.computed === true;

  if (node.type === 'MemberExpression' && key === 'property') return computed;

  if (
    (node.type === 'Property' || node.type === 'PropertyDefinition') &&
    key === 'key'
  ) {
    return computed;
  }

  return true;
};

/** Pre-order walk of an expression's subtree, stopping at the first hit. */
const firstMatch = (
  node: Node,
  matches: (candidate: Node) => boolean,
): Node | undefined => {
  if (matches(node)) return node;

  for (const [key, value] of Object.entries(node)) {
    if (!isReferenceKey(node, key)) continue;
    const children = Array.isArray(value) ? value : [value];

    for (const child of children) {
      if (!isNode(child)) continue;
      const found = firstMatch(child, matches);

      if (found !== undefined) return found;
    }
  }

  return undefined;
};

/**
 * `aria-current` beside classes composed from a `SrefStatusController`.
 *
 * The third of the aria-current rules, and the one that watches the host rather
 * than the template: `sref-active-aria-current` covers the element part,
 * `sref-active-class-aria-current` the attribute part, this one the controller.
 * A class bound from any controller read counts — `.active`, `.exact`,
 * `.status`, or the instance handed to a helper — because the classes are
 * derived from status either way.
 */
const srefStatusAriaCurrent: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'require an aria-current binding on a link element whose classes read a SrefStatusController',
    },
    messages: {
      missingAriaCurrent:
        "The classes on this <{{tag}}> read {{controller}}'s status, so it is active for CSS only; bind aria-current=${{{controller}}.ariaCurrent()} beside it so assistive technology gets the same signal.",
    },
    schema: [
      {
        type: 'object',
        properties: { linkElements: LINK_ELEMENTS_SCHEMA },
      },
    ],
    defaultOptions: [{}],
  },

  create(context) {
    const tracker = createDirectiveTracker(context);

    const { linkElements: option } =
      // SAFETY: the linter validates options against meta.schema before create runs
      (context.options[0] as { linkElements?: string[] } | undefined) ?? {};

    const linkElements = linkElementsOf(context, option);

    // One set per enclosing class body, innermost last: `this` in a template
    // belongs to the class it is written in, never to the one around it.
    const fields: Set<string>[] = [];

    // Top-level constructor statements only; branches and callbacks don't count.
    const constructorFields = (member: MethodNode): string[] => {
      const keys: string[] = [];

      // A `declare class` constructor parses with a null body, which ESTree's types omit.
      const block: MethodNode['value']['body'] | null | undefined =
        member.value?.body;

      for (const statement of block?.body ?? []) {
        if (statement.type !== 'ExpressionStatement') continue;
        const assignment = statement.expression;

        if (assignment.type !== 'AssignmentExpression') continue;

        if (assignment.operator !== '=') continue;

        if (!tracker.isControllerNew(asNode(assignment.right))) continue;
        const key = thisKeyOf(asNode(assignment.left));

        if (key !== undefined) keys.push(key);
      }

      return keys;
    };

    return {
      ImportDeclaration(node) {
        tracker.onImport(node);
      },

      ClassBody(node) {
        const held = new Set<string>();

        for (const member of node.body) {
          if (member.type === 'StaticBlock' || member.static) continue;

          if (member.type === 'PropertyDefinition') {
            const { value } = member;

            if (value === null || value === undefined) continue;

            if (!tracker.isControllerNew(asNode(value))) continue;
            const key = keyOf(member);

            if (key !== undefined) held.add(key);
            continue;
          }

          if (member.kind !== 'constructor') continue;

          for (const key of constructorFields(member)) held.add(key);
        }

        fields.push(held);
      },

      'ClassBody:exit'() {
        fields.pop();
      },

      TaggedTemplateExpression(node) {
        if (!tracker.shouldAnalyse) return;

        if (!tracker.isLitTemplate(asNode(node.tag))) return;

        const source = context.sourceCode;
        const expressions = asNodes(node.quasi.expressions);
        const analyzer = TemplateAnalyzer.create(node);
        const held = fields.at(-1) ?? new Set<string>();

        /** The first controller this expression reads, by either channel. */
        const controllerIn = (expression: Node): Node | undefined =>
          firstMatch(expression, (candidate) => {
            const key = thisKeyOf(candidate);

            if (key !== undefined) return held.has(key);

            return (
              candidate.type === 'Identifier' &&
              tracker.isControllerBinding(candidate)
            );
          });

        analyzer.traverse({
          enterElement(element) {
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            const tag = element.name;

            if (
              !isLinkElement(element, attributePartsOf(element), linkElements)
            )
              return;

            if (hasAriaCurrent(element)) return;

            for (const [name, value] of Object.entries(element.attribs)) {
              if (!CLASS_ATTRIBUTES.has(name)) continue;

              for (const match of value.matchAll(ATTRIBUTE_PART)) {
                const expression = expressions[Number(match[1])];

                if (expression === undefined) continue;
                const reference = controllerIn(expression);

                if (reference === undefined) continue;
                const controller = source.getText(toEstree(reference));
                // One report per element: the remedy is a single binding, and a
                // second insert would land on the same point.
                context.report({
                  node: expression,
                  messageId: 'missingAriaCurrent',
                  data: { tag, controller },
                  fix: (fixer) => {
                    const insert = attributeEnd(
                      source.getText(),
                      element,
                      name,
                      expressions,
                    );

                    return insert === undefined
                      ? null
                      : fixer.insertTextAfterRange(
                          [insert, insert],
                          ` aria-current=\${${controller}.ariaCurrent()}`,
                        );
                  },
                });

                return;
              }
            }
          },
        });
      },
    };
  },
};

export { srefStatusAriaCurrent };
