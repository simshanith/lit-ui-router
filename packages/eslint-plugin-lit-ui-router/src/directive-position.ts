// The runtime's constructor throw, statically (#667). Each directive accepts
// exactly one part type and throws on every other, which is a render-time
// failure a lint run can catch at author time.
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  createDirectiveTracker,
  type DirectiveName,
  elementPartIndex,
  type Node,
  type Parse5Element,
} from './directives.ts';

/**
 * The part type each directive accepts. This table is the single place a new
 * directive goes; an attribute-part one (`href=${…}`) gets its own row with
 * `'attribute'`, and the checks below branch on the value rather than assuming
 * every directive is element-only.
 */
const ALLOWED_POSITION: Record<DirectiveName, 'element'> = {
  uiSref: 'element',
  uiSrefActive: 'element',
};

export const RULE_NAME = 'directive-position';

/**
 * `uiSref` / `uiSrefActive` only where their part type allows.
 *
 * Only expressions of a lit template are considered: a call held in a variable
 * says nothing about where it lands, and guessing there would be false
 * positives, not coverage.
 */
const directivePosition: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require each lit-ui-router directive to sit in the template position its part type allows',
    },
    messages: {
      elementPartOnly:
        '`{{name}}` must be used as an element part (`<a ${{{name}}(...)}>`); it throws in attribute or child position.',
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

        // Every expression index the parsed template resolved to an element
        // part; anything else is an attribute, child or comment position.
        const elementParts = new Set<number>();
        analyzer.traverse({
          enterElement(rawElement) {
            const element = rawElement as unknown as Parse5Element;
            if (element.sourceCodeLocation === undefined) return;
            for (const attribute of Object.keys(element.attribs)) {
              const index = elementPartIndex(attribute);
              if (index !== undefined) elementParts.add(index);
            }
          },
        });

        expressions.forEach((expression, index) => {
          const name = tracker.directiveOf(expression);
          if (name === undefined) return;
          if (ALLOWED_POSITION[name] !== 'element') return;
          if (elementParts.has(index)) return;
          context.report({
            node: expression,
            messageId: 'elementPartOnly',
            data: { name },
          });
        });
      },
    };
  },
};

export { directivePosition };
