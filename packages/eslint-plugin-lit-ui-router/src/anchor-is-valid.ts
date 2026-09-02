// Vendored from eslint-plugin-lit-a11y 5.1.1 (lib/rules/anchor-is-valid.js plus
// its lit-html import gating), Copyright (c) 2018 open-wc contributors.
// MIT per the open-wc repo LICENSE, ISC per the package manifest.
// Extended so a uiSref element part counts as the href it assigns (#659, #676).
import type { Rule, SourceCode } from 'eslint';
// Deep path (no `exports` map guards it), but lit-a11y's own rules import the
// same one — a break here breaks lit-a11y first.
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';

// A lit template's element part (`<a ${uiSref('x')}>`) reaches parse5 as a bare
// placeholder, so it parses as a valueless attribute — same shape
// `eslint-plugin-lit`'s `util.isExpressionPlaceholder` matches, but capturing
// the index, which addresses the tagged template's own expressions.
const ELEMENT_PART = /^\{\{__q:(\d+)__\}\}$/i;

/** The lit-html packages the base rule's gating accepts before settings. */
const DEFAULT_LIT_HTML_SOURCES = ['lit-html', 'lit-element', 'lit'];

const ALL_ASPECTS = ['noHref', 'invalidHref', 'preferButton'];

// Minimal views of the two ASTs this rule crosses; eslint speaks ESTree and
// parse5 nodes arrive untyped through the analyzer's visitor.
interface Node {
  type: string;
  [key: string]: unknown;
}
interface CallNode extends Node {
  callee: Node;
  arguments: Node[];
}
/** parse5's Token.Location, structurally — parse5 itself is not a direct dep. */
interface Parse5Location {
  startLine: number;
  startCol: number;
  startOffset: number;
  endLine: number;
  endCol: number;
  endOffset: number;
}
interface Parse5Element {
  name: string;
  attribs: Record<string, string>;
  sourceCodeLocation?: { startTag?: Parse5Location };
}

interface RuleOptions {
  aspects?: string[];
  allowHash?: boolean;
}

/** Given `lit-html/lit-html.js`, the package name `lit-html`. */
const packageOf = (source: string): string =>
  source.split('/', source.startsWith('@') ? 2 : 1).join('/');

/** `name` (a collected local) or `ns.name` (a collected namespace). */
const references = (
  node: Node,
  locals: Set<string>,
  namespaces: Set<string>,
  name: string,
): boolean => {
  if (node.type === 'Identifier') {
    const id = node as { name?: string };
    return id.name !== undefined && locals.has(id.name);
  }
  if (node.type !== 'MemberExpression' || node.computed === true) return false;
  const object = node.object as { type?: string; name?: string };
  const property = (node.property as { name?: string } | undefined)?.name;
  return (
    object.type === 'Identifier' &&
    object.name !== undefined &&
    namespaces.has(object.name) &&
    property === name
  );
};

/**
 * Whether this call leaves the anchor with a runtime href. `assignHref` rides
 * in `uiSref(state, params?, options?)`'s options argument, and only a literal
 * `false` is a definite no — `'auto'` assigns on a native <a>, and a
 * non-literal is unknowable, so both stay suppressed rather than guessed.
 */
const assignsHref = (call: CallNode): boolean => {
  const options = call.arguments[2];
  if (options?.type !== 'ObjectExpression') return true;
  for (const property of (options.properties as Node[] | undefined) ?? []) {
    if (property.type !== 'Property' || property.computed === true) continue;
    const key = property.key as { name?: string; value?: unknown };
    if ((key.name ?? key.value) !== 'assignHref') continue;
    const value = property.value as Node & { value?: unknown };
    return !(value.type === 'Literal' && value.value === false);
  }
  return true;
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

/**
 * lit-a11y's anchor-is-valid, where a uiSref element part counts as an href.
 *
 * `<a ${uiSref('state')}>` carries no static href — the element-part directive
 * assigns one at runtime — so the stock rule reports every correct call site
 * (32 of them, #606). Vendoring rather than disabling keeps its real coverage:
 * an anchor with neither an href nor a directive still reports, and so does
 * `assignHref: false`, where the base rule is right for the right reason (#602).
 */
const anchorIsValid: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'anchor-is-valid for lit templates, where a uiSref element part counts as the href it assigns at runtime',
      url: 'https://github.com/simshanith/lit-ui-router/blob/main/packages/eslint-plugin-lit-ui-router/docs/rules/anchor-is-valid.md',
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
    // Per-file state in the closure, never on `parserServices`: oxlint freezes
    // it, and that mutation was the sole `jsPlugins` blocker (#676).
    const { litHtmlSources } = context.settings as {
      litHtmlSources?: boolean | string[];
    };
    const sources = new Set([
      ...DEFAULT_LIT_HTML_SOURCES,
      ...(Array.isArray(litHtmlSources) ? litHtmlSources : []),
    ]);
    // Falsy `litHtmlSources` means analyse every bare `html` tag, imported or not.
    let shouldAnalyse = !litHtmlSources;
    const litHtmlTags = new Set<string>(litHtmlSources ? [] : ['html']);
    const litHtmlNamespaces = new Set<string>();
    const srefLocals = new Set<string>();
    const srefNamespaces = new Set<string>();

    const isNavigable = (
      element: Parse5Element,
      expressions: Node[],
    ): boolean =>
      Object.keys(element.attribs).some((attribute) => {
        const match = ELEMENT_PART.exec(attribute);
        if (match === null) return false;
        const expression = expressions[Number(match[1])];
        if (expression?.type !== 'CallExpression') return false;
        const call = expression as CallNode;
        return (
          references(call.callee, srefLocals, srefNamespaces, 'uiSref') &&
          assignsHref(call)
        );
      });

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string') return;

        // Our directive: the import is what makes a `uiSref` call *ours*.
        if (/^lit-ui-router(\/|$)/.test(source)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === 'ImportNamespaceSpecifier') {
              srefNamespaces.add(specifier.local.name);
            } else if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier' &&
              specifier.imported.name === 'uiSref'
            ) {
              srefLocals.add(specifier.local.name);
            }
          }
        }

        shouldAnalyse =
          // A previous import supplied lit-html
          shouldAnalyse ||
          // litHtmlSources is falsy -> lint everything
          !litHtmlSources ||
          // litHtmlSources is an Array -> lint only the listed packages
          node.specifiers.some(
            (specifier) =>
              (specifier.type === 'ImportNamespaceSpecifier' ||
                specifier.type === 'ImportSpecifier') &&
              sources.has(packageOf(source)),
          );

        if (!shouldAnalyse) return;

        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            litHtmlNamespaces.add(specifier.local.name);
            litHtmlTags.add('html');
          } else if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'html'
          ) {
            litHtmlTags.add(specifier.local.name || 'html');
          }
        }
      },

      TaggedTemplateExpression(node) {
        if (!shouldAnalyse) return;
        const tag = node.tag as unknown as Node;
        if (!references(tag, litHtmlTags, litHtmlNamespaces, 'html')) return;

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
