// The runtime's aria-current takeover dev warning, statically (#667).
// uiSrefActive owns `aria-current` while its state is active and removes the
// attribute when it goes inactive — including one the author wrote — so an
// authored value is silently lost a navigation later.
import type { Rule } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  asNode,
  asNodes,
  attributePartsOf,
  type CallNode,
  createDirectiveTracker,
  elementPartIndex,
  hasSpread,
  isCallExpression,
  isLinkElement,
  isObjectExpression,
  propertyNamed,
  toEstree,
} from './directives.ts';

const OPT_OUT = 'ariaCurrentValue: false';

// The runtime's default checks the tag and role only, never declared link tags.
const NO_DECLARED_LINKS: ReadonlySet<string> = new Set();

export const RULE_NAME = 'sref-active-aria-current';

/**
 * An authored `aria-current` next to a `uiSrefActive` element part.
 *
 * Off a link element the runtime's default writes nothing, so only an explicit
 * `ariaCurrentValue` takes the attribute over there.
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
    const source = context.sourceCode;

    const check = (call: CallNode, tag: string, link: boolean): void => {
      const report = (fix?: Rule.ReportFixer): void => {
        context.report({
          node: call,
          messageId: 'ariaCurrentTakeover',
          data: { tag },
          fix,
        });
      };

      const params = call.arguments[0];

      if (params === undefined) {
        if (!link) return;
        const close = source.getLastToken(toEstree(call));

        if (close === null) return;
        report((fixer) => fixer.insertTextBefore(close, `{ ${OPT_OUT} }`));

        return;
      }

      if (!isObjectExpression(params) || hasSpread(params)) return;
      const property = propertyNamed(params, 'ariaCurrentValue');

      if (property === undefined) {
        if (!link) return;
        const first = params.properties[0];
        report((fixer) =>
          first === undefined
            ? fixer.replaceText(params, `{ ${OPT_OUT} }`)
            : fixer.insertTextBefore(first, `${OPT_OUT}, `),
        );

        return;
      }

      const { value } = property;

      // Non-literal is unknowable, so it stays suppressed.
      if (value.type !== 'Literal' || value.value === false) return;
      // An explicit value still takes the attribute over; rewriting
      // someone's deliberate choice is not this rule's business.
      report();
    };

    return {
      ImportDeclaration(node) {
        tracker.onImport(node);
      },

      TaggedTemplateExpression(node) {
        if (!tracker.shouldAnalyse) return;

        if (!tracker.isLitTemplate(asNode(node.tag))) return;

        const expressions = asNodes(node.quasi.expressions);
        const analyzer = TemplateAnalyzer.create(node);

        analyzer.traverse({
          enterElement(element) {
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            const attributes = Object.keys(element.attribs);

            if (!attributes.includes('aria-current')) return;

            // Off a link, only an explicit ariaCurrentValue writes the attribute.
            const link = isLinkElement(
              element,
              attributePartsOf(element),
              NO_DECLARED_LINKS,
            );

            for (const attribute of attributes) {
              const index = elementPartIndex(attribute);

              if (index === undefined) continue;
              const expression = expressions[index];

              if (
                !isCallExpression(expression) ||
                tracker.directiveOf(expression) !== 'uiSrefActive'
              ) {
                continue;
              }

              check(expression, element.name, link);
            }
          },
        });
      },
    };
  },
};

export { srefActiveAriaCurrent };
