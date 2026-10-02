// Vendored from eslint-plugin-lit-a11y 5.1.1 (lib/rules/anchor-is-valid.js plus
// its lit-html import gating), Copyright (c) 2018 open-wc.
// MIT per the open-wc repo LICENSE, ISC per the package manifest.
// Extended so a uiSref element part, and a srefHref bound in `href`, count as
// the href they assign (#659, #676).
import type { Rule, SourceCode } from 'eslint';
import type { RuleFor } from './rule-shape.ts';
// Deep path (no `exports` map guards it), but lit-a11y's own rules import the
// same one — a break here breaks lit-a11y first.
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  attributePartIndex,
  attributePartsOf,
  type CallNode,
  createDirectiveTracker,
  elementPartIndex,
  hasSpread,
  LINK_ELEMENTS_SCHEMA,
  linkElementsOf,
  type Node,
  type ObjectNode,
  type Parse5Element,
  propertyNamed,
  type Ranged,
  siblingBinding,
} from './directives.ts';

const ALL_ASPECTS = ['noHref', 'invalidHref', 'preferButton'];

interface RuleOptions {
  aspects?: string[];
  allowHash?: boolean;
  allowElementParts?: boolean;
  linkElements?: string[];
}

/**
 * Whether this call leaves the element with a runtime href. `assignHref` rides
 * in `uiSref(state, params?, options?)`'s options argument, and only a literal
 * `false` is a definite no — `'auto'` assigns on a native <a>, and a
 * non-literal is unknowable, so both stay suppressed rather than guessed.
 * On a declared link element `'auto'` is a definite no too: it tests the tag
 * name against HTML's link elements, and a declaration does not join that set.
 */
const assignsHref = (call: CallNode, nativeLink: boolean): boolean => {
  const options = call.arguments[2];
  if (options?.type !== 'ObjectExpression') return true;
  const property = propertyNamed(options as ObjectNode, 'assignHref');
  if (property === undefined) return true;
  if (property.value.type !== 'Literal') return true;
  const { value } = property.value;
  return !(value === false || (value === 'auto' && !nativeLink));
};

/**
 * The ranges to remove to turn `uiSref`'s options into `srefHref`'s: an
 * `assignHref` of literal `true` or `'auto'` is dropped, and with it an options
 * object it leaves empty. `undefined` when the arguments are not certain.
 */
const srefHrefRemovals = (
  call: CallNode,
  nativeLink: boolean,
): [number, number][] | undefined => {
  const [state, params, options] = call.arguments as (Node & Ranged)[];
  if (state === undefined || call.arguments.length > 3) return undefined;
  if (call.arguments.some((argument) => argument.type === 'SpreadElement')) {
    return undefined;
  }
  if (options === undefined) return [];
  if (options.type !== 'ObjectExpression') return undefined;
  const object = options as ObjectNode;
  if (hasSpread(object)) return undefined;
  if (object.properties.some((property) => property.computed === true)) {
    return undefined;
  }
  const property = propertyNamed(object, 'assignHref');
  if (property === undefined) return [];
  if (property.value.type !== 'Literal') return undefined;
  const { value } = property.value;
  if (!(value === true || (value === 'auto' && nativeLink))) return undefined;

  if (object.properties.length === 1) {
    // An `undefined` params placeholder only held the options' position.
    const keep =
      params?.type === 'Identifier' &&
      (params as { name?: string }).name === 'undefined'
        ? state
        : params;
    const from = keep?.range?.[1];
    const to = options.range?.[1];
    if (from === undefined || to === undefined) return undefined;
    return [[from, to]];
  }
  const properties = object.properties as (Node & Ranged)[];
  const at = properties.indexOf(property);
  const next = properties[at + 1];
  const previous = properties[at - 1];
  const range =
    next === undefined
      ? [previous?.range?.[1], (property as Ranged).range?.[1]]
      : [(property as Ranged).range?.[0], next.range?.[0]];
  const [start, end] = range;
  if (start === undefined || end === undefined) return undefined;
  return [[start, end]];
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
  // The analyzer returns an unresolved binding as a placeholder, not an href.
  return attributePartIndex(expr) === undefined ? expr : undefined;
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
    fixable: 'code',
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
          // ours (#676, #1065): upstream has neither, so no parity to keep.
          allowElementParts: {
            description:
              'Whether a uiSref element part counts as the href it assigns at runtime.',
            type: 'boolean',
          },
          linkElements: LINK_ELEMENTS_SCHEMA,
        },
      },
    ],
    defaultOptions: [{ allowHash: true, allowElementParts: true }],
  },

  create(context) {
    const tracker = createDirectiveTracker(context);
    const ruleOptions: RuleOptions =
      (context.options[0] as RuleOptions | undefined) ?? {};
    const linkElements = linkElementsOf(context, ruleOptions.linkElements);
    const allowElementParts = ruleOptions.allowElementParts !== false;

    /** The uiSref element parts on an element. */
    const uiSrefsOf = (
      element: Parse5Element,
      expressions: Node[],
    ): CallNode[] => {
      const calls: CallNode[] = [];
      for (const attribute of Object.keys(element.attribs)) {
        const index = elementPartIndex(attribute);
        if (index === undefined) continue;
        const expression = expressions[index];
        if (expression === undefined) continue;
        if (tracker.directiveOf(expression) === 'uiSref') {
          calls.push(expression as CallNode);
        }
      }
      return calls;
    };

    const isNavigable = (
      element: Parse5Element,
      expressions: Node[],
    ): boolean =>
      allowElementParts &&
      uiSrefsOf(element, expressions).some((call) =>
        assignsHref(call, element.name === 'a'),
      );

    // ours: the binding is the href, so there is no `assignHref` to opt out of.
    const bindsHref = (
      element: Parse5Element,
      expressions: Node[],
    ): boolean => {
      for (const [index, part] of attributePartsOf(element)) {
        if (part.name !== 'href') continue;
        const expression = expressions[index];
        if (expression === undefined) continue;
        if (tracker.directiveOf(expression) === 'srefHref') return true;
      }
      return false;
    };

    /**
     * `<a ${uiSref(...)}>` rewritten as `<a href=${srefHref(...)}>`, the form a
     * server render writes. Only a lone uiSref whose href is certain is fixed.
     */
    const toSrefHref = (
      element: Parse5Element,
      expressions: Node[],
    ): Rule.ReportFixer | undefined => {
      const calls = uiSrefsOf(element, expressions);
      const [call] = calls;
      if (call === undefined || calls.length > 1) return undefined;
      if (!assignsHref(call, element.name === 'a')) return undefined;
      const callee = call.callee as Node & Ranged;
      const start = (call as Ranged).range?.[0];
      const end = (call as Ranged).range?.[1];
      if (start === undefined || end === undefined) return undefined;
      const text = context.sourceCode.getText();
      const open = /\$\{\s*$/.exec(text.slice(0, start));
      if (open === null || !/^\s*\}/.test(text.slice(end))) return undefined;
      const removals = srefHrefRemovals(call, element.name === 'a');
      if (removals === undefined) return undefined;
      return (fixer) => {
        const sibling = siblingBinding(
          fixer,
          context.sourceCode,
          callee,
          'srefHref',
        );
        if (sibling === undefined) return null;
        return [
          ...sibling.edits,
          fixer.insertTextBeforeRange([open.index, open.index], 'href='),
          fixer.replaceText(callee, sibling.binding),
          ...removals.map((range) => fixer.removeRange(range)),
        ];
      };
    };

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
            // A declared link element is checked as an <a> is (#676).
            if (element.name !== 'a' && !linkElements.has(element.name)) return;

            const hasAspectsOption = Array.isArray(ruleOptions.aspects);
            const activeAspects = {
              noHref: hasAspectsOption
                ? ruleOptions.aspects?.includes('noHref') === true
                : true,
              invalidHref: hasAspectsOption
                ? ruleOptions.aspects?.includes('invalidHref') === true
                : true,
              preferButton: hasAspectsOption
                ? ruleOptions.aspects?.includes('preferButton') === true
                : true,
            };

            const attributes = Object.keys(element.attribs);
            const hasAnyHref =
              attributes.includes('href') ||
              attributes.includes('.href') ||
              // ours: the element part assigns one at runtime
              isNavigable(element, expressions) ||
              bindsHref(element, expressions);
            const hasClickListener = attributes.includes('@click');

            const reportLoc = () =>
              (startTag === undefined
                ? null
                : analyzer.resolveLocation(startTag, source)) ??
              node.loc ??
              null;

            // When there is no href at all, specific scenarios apply:
            if (!hasAnyHref) {
              const fix = allowElementParts
                ? undefined
                : toSrefHref(element, expressions);
              if (
                activeAspects.noHref &&
                (!hasClickListener ||
                  (hasClickListener && !activeAspects.preferButton))
              ) {
                const loc = reportLoc();
                if (loc) {
                  context.report({ loc, messageId: 'noHrefErrorMessage', fix });
                }
              }

              if (hasClickListener && activeAspects.preferButton) {
                const loc = reportLoc();
                if (loc) {
                  context.report({
                    loc,
                    messageId: 'preferButtonErrorMessage',
                    fix,
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
                (ruleOptions.allowHash === false && value === '#') ||
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
