// The runtime's `assignHref` dev warning, statically (#667). uiSref writes an
// href to whatever element carries it under the 1.x default; on a native
// non-link that href is inert, and the runtime says so once, in dev, in the
// console. This rule says it at author time, with the documented fix.
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

/** The elements HTML gives an `href`; `'auto'` writes to these and no others. */
const NATIVE_LINKS = new Set(['a', 'area']);

const AUTO = "{ assignHref: 'auto' }";

export const RULE_NAME = 'sref-assign-href';

/**
 * `assignHref: 'auto'` on every native non-link.
 *
 * A custom element is exempt: `'auto'` tests the tag name, not the shape, so
 * a `<sp-link>` that forwards `href` wants the `true` default and only its
 * author can say so. A non-literal options argument is unknowable, so it stays
 * suppressed rather than guessed — the same posture `anchor-is-valid` takes.
 */
const srefAssignHref: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        "require assignHref: 'auto' when a uiSref element part rides a native element with no href",
    },
    messages: {
      hrefOnNonLink:
        "uiSref writes an href to <{{tag}}>, which has no href in HTML. Pass { assignHref: 'auto' } to write it only to links; 'auto' becomes the default in 2.0.",
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

        const expressions = node.quasi.expressions as unknown as Node[];
        const analyzer = TemplateAnalyzer.create(node);

        analyzer.traverse({
          enterElement(rawElement) {
            const element = rawElement as unknown as Parse5Element;
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            const tag = element.name;
            if (tag.includes('-') || NATIVE_LINKS.has(tag)) return;

            for (const attribute of Object.keys(element.attribs)) {
              const index = elementPartIndex(attribute);
              if (index === undefined) continue;
              const expression = expressions[index];
              if (
                expression === undefined ||
                tracker.directiveOf(expression) !== 'uiSref'
              ) {
                continue;
              }
              const call = expression as CallNode;
              const report = (fix: Rule.ReportFixer): void => {
                context.report({
                  node: call,
                  messageId: 'hrefOnNonLink',
                  data: { tag },
                  fix,
                });
              };

              const options = call.arguments[2];
              if (options === undefined) {
                const previous = call.arguments[1] ?? call.arguments[0];
                // `uiSref()` has no argument to append after; report unfixed.
                if (previous === undefined) {
                  context.report({
                    node: call,
                    messageId: 'hrefOnNonLink',
                    data: { tag },
                  });
                  continue;
                }
                const filler = call.arguments.length === 1 ? ', {}' : '';
                report((fixer) =>
                  fixer.insertTextAfter(previous, `${filler}, ${AUTO}`),
                );
                continue;
              }

              if (options.type !== 'ObjectExpression') continue;
              const object = options as ObjectNode;
              if (hasSpread(object)) continue;
              const property = propertyNamed(object, 'assignHref');

              if (property === undefined) {
                const first = object.properties[0];
                report((fixer) =>
                  first === undefined
                    ? fixer.replaceText(object, AUTO)
                    : fixer.insertTextBefore(first, "assignHref: 'auto', "),
                );
                continue;
              }

              const { value } = property;
              if (value.type !== 'Literal') continue;
              if (value.value === 'auto' || value.value === false) continue;
              report((fixer) => fixer.replaceText(value, "'auto'"));
            }
          },
        });
      },
    };
  },
};

export { srefAssignHref };
