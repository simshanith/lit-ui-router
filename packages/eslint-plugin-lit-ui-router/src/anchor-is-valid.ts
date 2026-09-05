// Vendored from eslint-plugin-lit-a11y 5.1.1 (lib/rules/anchor-is-valid.js plus
// its lit-html import gating), Copyright (c) 2018 open-wc.
// MIT per the open-wc repo LICENSE, ISC per the package manifest.
// Extended so a uiSref element part counts as the href it assigns (#659, #676).
import type { SourceCode } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
// Deep path (no `exports` map guards it), but lit-a11y's own rules import the
// same one — a break here breaks lit-a11y first.
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  type CallNode,
  createDirectiveTracker,
  elementPartIndex,
  type Node,
  type ObjectNode,
  type Parse5Element,
  propertyNamed,
} from './directives.ts';

const ALL_ASPECTS = ['noHref', 'invalidHref', 'preferButton'];

interface RuleOptions {
  aspects?: string[];
  allowHash?: boolean;
}

/**
 * Whether this call leaves the anchor with a runtime href. `assignHref` rides
 * in `uiSref(state, params?, options?)`'s options argument, and only a literal
 * `false` is a definite no — `'auto'` assigns on a native <a>, and a
 * non-literal is unknowable, so both stay suppressed rather than guessed.
 */
const assignsHref = (call: CallNode): boolean => {
  const options = call.arguments[2];
  if (options?.type !== 'ObjectExpression') return true;
  const property = propertyNamed(options as ObjectNode, 'assignHref');
  if (property === undefined) return true;
  return !(property.value.type === 'Literal' && property.value.value === false);
};

/** Literal-or-undefined over the analyzer's attribute value (lit-a11y util). */
const getLiteralAttributeValue = (
  analyzer: TemplateAnalyzer,
  element: Parse5Element,
  attr: string,
  source: SourceCode,
): string | undefined => {
  const expr = analyzer.getAttributeValue(element as never, attr, source);
  if (expr === null) return undefined;
  if (typeof expr !== 'string') {
    if (expr.type === 'Literal') return expr.value as string | undefined;
    return undefined;
  }
  return expr;
};

export const RULE_NAME = 'anchor-is-valid';

/**
 * lit-a11y's anchor-is-valid, where a uiSref element part counts as an href.
 *
 * `<a ${uiSref('state')}>` carries no static href — the element-part directive
 * assigns one at runtime — so the stock rule reports every correct call site
 * (32 of them, #606). Vendoring rather than disabling keeps its real coverage:
 * an anchor with neither an href nor a directive still reports, and so does
 * `assignHref: false`, where the base rule is right for the right reason (#602).
 */
const anchorIsValid: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'anchor-is-valid for lit templates, where a uiSref element part counts as the href it assigns at runtime',
    },
    messages: {
      preferButtonErrorMessage:
        'Anchor used as a button. Anchors are primarily expected to navigate. Use the button element instead.',
      noHrefErrorMessage:
        'The href attribute is required for an anchor to be keyboard accessible. Provide a valid, navigable address as the href value. If you cannot provide an href, but still need the element to resemble a link, use a button and change it with appropriate styles.',
      invalidHrefErrorMessage:
        'The href attribute requires a valid value to be accessible. Provide a valid, navigable address as the href value. If you cannot provide a valid href, but still need the element to resemble a link, use a button and change it with appropriate styles.',
    },
    // Upstream's schema, plus the ajv descriptions and the `defaultOptions`
    // hoist this repo's rule-authoring lane requires. Both are annotations:
    // the accepted options and the effective `allowHash` default are unchanged.
    schema: [
      {
        type: 'object',
        properties: {
          aspects: {
            description: 'Which anchor checks are active.',
            type: 'array',
            items: { type: 'string', enum: ALL_ASPECTS },
            uniqueItems: true,
            additionalItems: false,
            minItems: 1,
          },
          allowHash: {
            description: 'Whether a bare `#` counts as a valid href.',
            type: 'boolean',
          },
        },
      },
    ],
    defaultOptions: [{ allowHash: true }],
  },

  create(context) {
    const tracker = createDirectiveTracker(context);

    const isNavigable = (
      element: Parse5Element,
      expressions: Node[],
    ): boolean =>
      Object.keys(element.attribs).some((attribute) => {
        const index = elementPartIndex(attribute);
        if (index === undefined) return false;
        const expression = expressions[index];
        if (expression === undefined) return false;
        return (
          tracker.directiveOf(expression) === 'uiSref' &&
          assignsHref(expression as CallNode)
        );
      });

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
            const startTag = element.sourceCodeLocation?.startTag;
            // probably a tree correction node
            if (element.sourceCodeLocation === undefined) return;
            if (element.name !== 'a') return;

            const options: RuleOptions =
              (context.options[0] as RuleOptions | undefined) ?? {};
            const hasAspectsOption = Array.isArray(options.aspects);
            const activeAspects = {
              noHref: hasAspectsOption
                ? options.aspects?.includes('noHref') === true
                : true,
              invalidHref: hasAspectsOption
                ? options.aspects?.includes('invalidHref') === true
                : true,
              preferButton: hasAspectsOption
                ? options.aspects?.includes('preferButton') === true
                : true,
            };

            const attributes = Object.keys(element.attribs);
            const hasAnyHref =
              attributes.includes('href') ||
              attributes.includes('.href') ||
              // ours: the element part assigns one at runtime
              isNavigable(element, expressions);
            const hasClickListener = attributes.includes('@click');

            const reportLoc = () =>
              (startTag === undefined
                ? null
                : analyzer.resolveLocation(startTag, source)) ??
              node.loc ??
              null;

            // When there is no href at all, specific scenarios apply:
            if (!hasAnyHref) {
              if (
                activeAspects.noHref &&
                (!hasClickListener ||
                  (hasClickListener && !activeAspects.preferButton))
              ) {
                const loc = reportLoc();
                if (loc)
                  context.report({ loc, messageId: 'noHrefErrorMessage' });
              }

              if (hasClickListener && activeAspects.preferButton) {
                const loc = reportLoc();
                if (loc) {
                  context.report({
                    loc,
                    messageId: 'preferButtonErrorMessage',
                  });
                }
              }
              return;
            }

            // Hrefs have been found, now check for validity.
            const value =
              getLiteralAttributeValue(analyzer, element, 'href', source) ??
              getLiteralAttributeValue(analyzer, element, '.href', source);

            const invalidHrefValue =
              typeof value === 'string' &&
              (!value.length ||
                (options.allowHash === false && value === '#') ||
                /^\W*?javascript:/.test(value));

            if (!invalidHrefValue) return;

            if (hasClickListener && activeAspects.preferButton) {
              const loc = reportLoc();
              if (loc) {
                context.report({ loc, messageId: 'preferButtonErrorMessage' });
              }
            } else if (activeAspects.invalidHref) {
              const loc = reportLoc();
              if (loc) {
                context.report({ loc, messageId: 'invalidHrefErrorMessage' });
              }
            }
          },
        });
      },
    };
  },
};

export { anchorIsValid };
