// The runtime's constructor throw, statically (#667). Each directive accepts
// exactly one part type and throws on every other, which is a render-time
// failure a lint run can catch at author time.
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  type AttributePart,
  attributePartsOf,
  createDirectiveTracker,
  type DirectiveName,
  elementPartIndex,
  type Node,
  type Parse5Element,
} from './directives.ts';

/**
 * The part type each directive accepts. This table is the single place a new
 * directive goes, and the checks below branch on the value rather than assuming
 * every directive is element-only.
 */
const ALLOWED_POSITION: Record<DirectiveName, 'element' | 'attribute'> = {
  uiSref: 'element',
  uiSrefActive: 'element',
  srefHref: 'attribute',
  srefActiveClass: 'attribute',
  srefAriaCurrent: 'attribute',
};

/** Attribute-part directives that additionally accept one attribute and no other. */
const ALLOWED_ATTRIBUTE: Partial<Record<DirectiveName, string>> = {
  srefActiveClass: 'class',
};

/**
 * Attribute-part directives that must be the *whole* value, not merely the only
 * expression: their constructors reject `strings` outright, where
 * `srefActiveClass` follows classMap and keeps the static classes around it.
 */
const WHOLE_VALUE: Partial<Record<DirectiveName, true>> = {
  srefHref: true,
  srefAriaCurrent: true,
};

export const RULE_NAME = 'directive-position';

/**
 * Every lit-ui-router directive only where its part type allows.
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
      attributePartOnly:
        '`{{name}}` must be used as an attribute part (`attr=${{{name}}(...)}`); it throws as an element part and in child position.',
      soleAttributeExpression:
        '`{{name}}` must be the only expression in its attribute; it throws when the attribute value is interpolated around it.',
      classAttributeOnly:
        '`{{name}}` must be bound in the `class` attribute (`class=${{{name}}(...)}`); it throws in any other attribute.',
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
        const attributeParts = new Map<number, AttributePart>();
        analyzer.traverse({
          enterElement(rawElement) {
            const element = rawElement as unknown as Parse5Element;
            if (element.sourceCodeLocation === undefined) return;
            for (const attribute of Object.keys(element.attribs)) {
              const index = elementPartIndex(attribute);
              if (index !== undefined) elementParts.add(index);
            }
            for (const [index, part] of attributePartsOf(element)) {
              attributeParts.set(index, part);
            }
          },
        });

        expressions.forEach((expression, index) => {
          const name = tracker.directiveOf(expression);
          if (name === undefined) return;
          const report = (
            messageId:
              | 'elementPartOnly'
              | 'attributePartOnly'
              | 'soleAttributeExpression'
              | 'classAttributeOnly',
          ): void => {
            context.report({ node: expression, messageId, data: { name } });
          };

          if (ALLOWED_POSITION[name] === 'element') {
            if (!elementParts.has(index)) report('elementPartOnly');
            return;
          }

          const part = attributeParts.get(index);
          if (part === undefined) {
            report('attributePartOnly');
            return;
          }
          const attribute = ALLOWED_ATTRIBUTE[name];
          if (attribute !== undefined && part.name !== attribute) {
            report('classAttributeOnly');
            return;
          }
          if (WHOLE_VALUE[name] === true ? !part.whole : !part.only) {
            report('soleAttributeExpression');
          }
        });
      },
    };
  },
};

export { directivePosition };
