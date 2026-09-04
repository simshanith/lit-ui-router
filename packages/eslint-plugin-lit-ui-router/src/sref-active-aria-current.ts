// The runtime's aria-current takeover dev warning, statically (#667).
// uiSrefActive owns `aria-current` while its state is active and removes the
// attribute when it goes inactive — including one the author wrote — so an
// authored value is silently lost a navigation later.
import type { Rule } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  type CallNode,
  createDirectiveTracker,
  elementPartIndex,
  hasSpread,
  type Node,
  type ObjectNode,
  type Parse5Element,
  propertyNamed,
} from './directives.ts';

const OPT_OUT = 'ariaCurrentValue: false';

export const RULE_NAME = 'sref-active-aria-current';

/**
 * An authored `aria-current` next to a `uiSrefActive` element part.
 *
 * The fix is the runtime's own: `ariaCurrentValue: false` keeps the attribute
 * under the app's control. A non-literal params argument is unknowable, so it
 * stays suppressed rather than guessed.
 */
const srefActiveAriaCurrent: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'disallow an authored aria-current on an element a uiSrefActive element part manages',
    },
    messages: {
      ariaCurrentTakeover:
        'uiSrefActive takes over the aria-current authored on <{{tag}}>; the attribute is removed when the state goes inactive. Pass ariaCurrentValue: false to keep the attribute under your own control.',
    },
    schema: [],
  },

  create(context) {
    const tracker = createDirectiveTracker(context);

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

        analyzer.traverse({
          enterElement(rawElement) {
            const element = rawElement as unknown as Parse5Element;
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            const attributes = Object.keys(element.attribs);
            if (!attributes.includes('aria-current')) return;

            for (const attribute of attributes) {
              const index = elementPartIndex(attribute);
              if (index === undefined) continue;
              const expression = expressions[index];
              if (
                expression === undefined ||
                tracker.directiveOf(expression) !== 'uiSrefActive'
              ) {
                continue;
              }
              const call = expression as CallNode;
              const report = (fix: Rule.ReportFixer): void => {
                context.report({
                  node: call,
                  messageId: 'ariaCurrentTakeover',
                  data: { tag: element.name },
                  fix,
                });
              };

              const params = call.arguments[0];
              if (params === undefined) {
                const close = source.getLastToken(call as never);
                if (close === null) continue;
                report((fixer) =>
                  fixer.insertTextBefore(close, `{ ${OPT_OUT} }`),
                );
                continue;
              }

              if (params.type !== 'ObjectExpression') continue;
              const object = params as ObjectNode;
              if (hasSpread(object)) continue;
              const property = propertyNamed(object, 'ariaCurrentValue');

              if (property === undefined) {
                const first = object.properties[0];
                report((fixer) =>
                  first === undefined
                    ? fixer.replaceText(object, `{ ${OPT_OUT} }`)
                    : fixer.insertTextBefore(first, `${OPT_OUT}, `),
                );
                continue;
              }

              const { value } = property;
              // Non-literal is unknowable, so it stays suppressed.
              if (value.type !== 'Literal' || value.value === false) continue;
              // An explicit value still takes the attribute over; rewriting
              // someone's deliberate choice is not this rule's business.
              context.report({
                node: call,
                messageId: 'ariaCurrentTakeover',
                data: { tag: element.name },
              });
            }
          },
        });
      },
    };
  },
};

export { srefActiveAriaCurrent };
