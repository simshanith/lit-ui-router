// The a11y half of the attribute-part pair (#667). uiSrefActive writes
// `aria-current` itself; `class=${srefActiveClass(...)}` only paints, so a link
// styled active stays silent to assistive technology unless srefAriaCurrent is
// bound beside it.
import type { Rule } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  attributeEnd,
  attributePartsOf,
  type CallNode,
  createDirectiveTracker,
  hasAriaCurrent,
  hasSpread,
  isLinkElement,
  isOurPackage,
  LINK_ELEMENTS_SCHEMA,
  linkElementsOf,
  type Node,
  type ObjectNode,
  type Parse5Element,
  propertyNamed,
} from './directives.ts';

/** The params srefAriaCurrent shares with srefActiveClass; the classes are its own. */
const SHARED_PARAMS = ['state', 'params', 'options'];

const DIRECTIVE = 'srefAriaCurrent';

/** A named import specifier, structurally. */
interface SpecifierNode extends Node {
  imported: Node & { name?: string };
  local: Node & { name?: string };
}

export const RULE_NAME = 'sref-active-class-aria-current';

/**
 * `aria-current` beside a `srefActiveClass` binding on a link.
 *
 * The mirror of `sref-active-aria-current`: that rule protects an authored
 * attribute from the element part's takeover, this one asks for the attribute
 * the attribute part never writes. Non-links stay quiet, the way the runtime's
 * own default does — `aria-current` on a wrapper is rarely what was meant.
 */
const srefActiveClassAriaCurrent: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'require an aria-current binding beside a srefActiveClass binding on a link element',
    },
    messages: {
      missingAriaCurrent:
        'srefActiveClass marks this <{{tag}}> active for CSS only; bind aria-current=${srefAriaCurrent({{params}})} beside it so assistive technology gets the same signal.',
      unknownAriaCurrent:
        'srefActiveClass marks this <{{tag}}> active for CSS only; bind aria-current=${srefAriaCurrent(...)} with the same state, params and options beside it so assistive technology gets the same signal.',
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
      (context.options[0] as { linkElements?: string[] } | undefined) ?? {};
    const linkElements = linkElementsOf(context, option);

    return {
      ImportDeclaration(node) {
        tracker.onImport(node);
      },

      TaggedTemplateExpression(node) {
        if (!tracker.shouldAnalyse) return;
        if (!tracker.isLitTemplate(node.tag as unknown as Node)) return;

        const source = context.sourceCode;
        const expressions = node.quasi.expressions as unknown as Node[];
        const analyzer = TemplateAnalyzer.create(node);

        /** Named specifiers of every lit-ui-router import in this file. */
        const ourSpecifiers = (): SpecifierNode[] => {
          const found: SpecifierNode[] = [];
          for (const statement of source.ast.body) {
            if (statement.type !== 'ImportDeclaration') continue;
            const from = statement.source.value;
            if (typeof from !== 'string' || !isOurPackage(from)) continue;
            for (const specifier of statement.specifiers) {
              if (specifier.type !== 'ImportSpecifier') continue;
              found.push(specifier as unknown as SpecifierNode);
            }
          }
          return found;
        };

        /** The `state`, `params` and `options` the fix copies, as written. */
        const paramsLiteral = (object: ObjectNode): string => {
          const kept = SHARED_PARAMS.map((name) =>
            propertyNamed(object, name),
          ).filter((property) => property !== undefined);
          return kept.length === 0
            ? '{}'
            : `{ ${kept
                .map((property) => source.getText(property as never))
                .join(', ')} }`;
        };

        /** The `aria-current` binding, plus the import that makes it resolve. */
        const bind = (
          fixer: Rule.RuleFixer,
          call: CallNode,
          literal: string,
          element: Parse5Element,
        ): Rule.Fix[] | null => {
          const insert = attributeEnd(
            source.getText(),
            element,
            'class',
            expressions,
          );
          if (insert === undefined) return null;

          const { callee } = call;
          const edits: Rule.Fix[] = [];
          let binding: string;
          if (callee.type === 'MemberExpression') {
            // The same namespace already carries it, so no import to add.
            binding = `${source.getText(callee.object as never)}.${DIRECTIVE}`;
          } else {
            const specifiers = ourSpecifiers();
            const existing = specifiers.find(
              (specifier) => specifier.imported.name === DIRECTIVE,
            );
            if (existing !== undefined) {
              binding = existing.local.name ?? DIRECTIVE;
            } else {
              const anchor = specifiers.find(
                (specifier) =>
                  specifier.local.name === (callee as { name?: string }).name,
              );
              if (anchor === undefined) return null;
              binding = DIRECTIVE;
              edits.push(
                fixer.insertTextAfter(anchor as never, `, ${DIRECTIVE}`),
              );
            }
          }

          edits.push(
            fixer.insertTextAfterRange(
              [insert, insert],
              ` aria-current=\${${binding}(${literal})}`,
            ),
          );
          return edits;
        };

        analyzer.traverse({
          enterElement(rawElement) {
            const element = rawElement as unknown as Parse5Element;
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            const tag = element.name;
            const parts = attributePartsOf(element);
            if (!isLinkElement(element, parts, linkElements)) return;
            // Any aria-current at all is the author's, and whether its value is
            // right is not this rule's business.
            if (hasAriaCurrent(element)) return;

            for (const [index, part] of parts) {
              if (part.name !== 'class') continue;
              const expression = expressions[index];
              if (
                expression === undefined ||
                tracker.directiveOf(expression) !== 'srefActiveClass'
              ) {
                continue;
              }
              const call = expression as CallNode;
              const params = call.arguments[0];
              const object =
                params?.type === 'ObjectExpression' &&
                !hasSpread(params as ObjectNode)
                  ? (params as ObjectNode)
                  : undefined;
              // A missing or unknowable params literal has nothing to copy, so
              // the message cannot name the call the fix would have written.
              if (object === undefined) {
                context.report({
                  node: call,
                  messageId: 'unknownAriaCurrent',
                  data: { tag },
                });
                continue;
              }

              const literal = paramsLiteral(object);
              context.report({
                node: call,
                messageId: 'missingAriaCurrent',
                data: { tag, params: literal },
                fix: (fixer) => bind(fixer, call, literal, element),
              });
            }
          },
        });
      },
    };
  },
};

export { srefActiveClassAriaCurrent };
