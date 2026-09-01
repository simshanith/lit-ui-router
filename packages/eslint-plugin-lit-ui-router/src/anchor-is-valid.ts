// The `lit-ui-router/anchor-is-valid` rule: lit-a11y's anchor-is-valid,
// wrapped so a uiSref element part counts as the href it assigns at runtime (#659).
import type { Rule, SourceCode } from 'eslint';
import litA11y from 'eslint-plugin-lit-a11y';
// Deep path (no `exports` map guards it), but lit-a11y's own rules import the
// same one — a break here breaks lit-a11y first.
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import ruleExtender from 'eslint-rule-extender';

// A lit template's element part (`<a ${uiSref('x')}>`) reaches parse5 as a bare
// `{{__Q:n__}}` placeholder, so it parses as a valueless attribute — and `n`
// indexes the tagged template's own expressions.
const ELEMENT_PART = /^\{\{__q:(\d+)__\}\}$/i;

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

const walk = (value: unknown, visit: (node: Node) => void): void => {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  const node = value as Node;
  if (typeof node.type !== 'string') return;
  visit(node);
  for (const [key, child] of Object.entries(node)) {
    // `parent` is eslint's back-reference; following it never terminates.
    if (key !== 'parent') walk(child, visit);
  }
};

/**
 * The import bindings the scan keys on: `uiSref` locals and namespaces from
 * lit-ui-router (the import is what makes it *our* directive), plus the `html`
 * tag locals and namespaces the base rule accepts — its report loc has to be
 * matchable by this scan for every template the base rule analyses.
 */
interface Bindings {
  sref: Set<string>;
  srefNamespaces: Set<string>;
  htmlTags: Set<string>;
  htmlNamespaces: Set<string>;
}

const packageOf = (source: string): string =>
  source.split('/', source.startsWith('@') ? 2 : 1).join('/');

// The default sources of the base rule's HasLitHtmlImportRuleExtension.
const LIT_SOURCES = new Set(['lit', 'lit-html', 'lit-element']);

const importBindings = (ast: Node): Bindings => {
  const bindings: Bindings = {
    sref: new Set(),
    srefNamespaces: new Set(),
    // With no `litHtmlSources` setting the base rule analyses every bare
    // `html` tag, imported or not — mirror that or the wrap under-suppresses.
    htmlTags: new Set(['html']),
    htmlNamespaces: new Set(),
  };
  for (const statement of (ast.body as Node[] | undefined) ?? []) {
    if (statement.type !== 'ImportDeclaration') continue;
    const source = (statement.source as { value?: unknown }).value;
    if (typeof source !== 'string') continue;
    const fromRouter = /^lit-ui-router(\/|$)/.test(source);
    const fromLit = LIT_SOURCES.has(packageOf(source));
    if (!fromRouter && !fromLit) continue;
    for (const specifier of statement.specifiers as Node[]) {
      const local = (specifier.local as { name?: string } | undefined)?.name;
      if (local === undefined) continue;
      if (specifier.type === 'ImportNamespaceSpecifier') {
        (fromRouter ? bindings.srefNamespaces : bindings.htmlNamespaces).add(
          local,
        );
        continue;
      }
      if (specifier.type !== 'ImportSpecifier') continue;
      const imported = (specifier.imported as { name?: string } | undefined)
        ?.name;
      if (fromRouter && imported === 'uiSref') bindings.sref.add(local);
      if (fromLit && imported === 'html') bindings.htmlTags.add(local);
    }
  }
  return bindings;
};

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

/** Start-tag locations of anchors a uiSref part makes navigable. */
const navigableAnchors = (source: SourceCode): SourceLoc[] => {
  const locations: SourceLoc[] = [];
  const ast = source.ast as unknown as Node;
  const bindings = importBindings(ast);
  if (bindings.sref.size === 0 && bindings.srefNamespaces.size === 0) {
    return locations;
  }

  walk(ast, (node) => {
    if (node.type !== 'TaggedTemplateExpression') return;
    const tag = node.tag as Node;
    if (!references(tag, bindings.htmlTags, bindings.htmlNamespaces, 'html')) {
      return;
    }
    const expressions = (node.quasi as { expressions: Node[] }).expressions;

    const analyzer = TemplateAnalyzer.create(node as never);
    analyzer.traverse({
      enterElement: (element) => {
        const el = element as unknown as Parse5Element;
        const startTag = el.sourceCodeLocation?.startTag;
        if (el.name !== 'a' || startTag === undefined) return;
        const navigable = Object.keys(el.attribs).some((attribute) => {
          const match = ELEMENT_PART.exec(attribute);
          if (match === null) return false;
          const expression = expressions[Number(match[1])];
          if (expression?.type !== 'CallExpression') return false;
          const call = expression as CallNode;
          return (
            references(
              call.callee,
              bindings.sref,
              bindings.srefNamespaces,
              'uiSref',
            ) && assignsHref(call)
          );
        });
        if (!navigable) return;
        const loc = analyzer.resolveLocation(startTag, source);
        if (loc !== null) locations.push(loc);
      },
    });
  });
  return locations;
};

interface SourceLoc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

const sameLoc = (a: SourceLoc, b: SourceLoc): boolean =>
  a.start.line === b.start.line &&
  a.start.column === b.start.column &&
  a.end.line === b.end.line &&
  a.end.column === b.end.column;

// One scan per file, not per report: anchor-is-valid reports once per anchor.
const cache = new WeakMap<object, SourceLoc[]>();
const anchorsFor = (source: SourceCode): SourceLoc[] => {
  const key = source.ast as unknown as object;
  let found = cache.get(key);
  if (found === undefined) {
    found = navigableAnchors(source);
    cache.set(key, found);
  }
  return found;
};

// The two messages that mean "this anchor has no href". `invalidHref` only
// fires when an href is present, so a directive never makes it a false positive.
const NO_HREF_MESSAGES = new Set([
  'noHrefErrorMessage',
  'preferButtonErrorMessage',
]);

/**
 * lit-a11y's anchor-is-valid, minus the uiSref false positives.
 *
 * `<a ${uiSref('state')}>` carries no static href — the element-part directive
 * assigns one at runtime — so the stock rule reports every correct call site
 * (32 of them, #606). Wrapping rather than disabling keeps its real coverage:
 * an anchor with neither an href nor a directive still reports, and so does
 * `assignHref: false`, where the rule is right for the right reason (#602).
 */
const anchorIsValid: Rule.RuleModule = ruleExtender(
  litA11y.rules['anchor-is-valid'],
  {
    reportOverrides: (descriptor, context) => {
      const { messageId } = descriptor;
      if (messageId === undefined || !NO_HREF_MESSAGES.has(messageId)) {
        return true;
      }
      const loc = descriptor.loc;
      if (loc === undefined) return true;
      return !anchorsFor(context.sourceCode).some((anchor) =>
        sameLoc(anchor, loc),
      );
    },
  },
);

export { anchorIsValid };
