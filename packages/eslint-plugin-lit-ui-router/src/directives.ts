// Shared template plumbing for every rule in this plugin: the element-part
// placeholder shape, the lit-html import gating vendored from lit-a11y, and
// the `lit-ui-router` import tracking that makes a `uiSref` call *ours*.
// Syntax-only by construction — no type information, so the rules also load
// into oxlint `jsPlugins` (#676).
import type { Rule } from 'eslint';

/** The node type eslint hands a listener, without naming `estree` directly. */
type ListenerNode<K extends keyof Rule.NodeListener> = Parameters<
  NonNullable<Rule.NodeListener[K]>
>[0];

// A lit template's element part (`<a ${uiSref('x')}>`) reaches parse5 as a bare
// placeholder, so it parses as a valueless attribute — same shape
// `eslint-plugin-lit`'s `util.isExpressionPlaceholder` matches, but capturing
// the index, which addresses the tagged template's own expressions.
const ELEMENT_PART = /^\{\{__q:(\d+)__\}\}$/i;

/** The lit-html packages the base rule's gating accepts before settings. */
const DEFAULT_LIT_HTML_SOURCES = ['lit-html', 'lit-element', 'lit'];

/** The directives these rules understand. */
export type DirectiveName = 'uiSref' | 'uiSrefActive';

const DIRECTIVE_NAMES: DirectiveName[] = ['uiSref', 'uiSrefActive'];

// Minimal views of the two ASTs these rules cross; eslint speaks ESTree and
// parse5 nodes arrive untyped through the analyzer's visitor.
export interface Node {
  type: string;
  [key: string]: unknown;
}
export interface CallNode extends Node {
  callee: Node;
  arguments: Node[];
}
export interface ObjectNode extends Node {
  properties: Node[];
}
export interface PropertyNode extends Node {
  key: Node & { name?: string; value?: unknown };
  value: Node & { value?: unknown };
  computed?: boolean;
}
/** parse5's Token.Location, structurally — parse5 itself is not a direct dep. */
export interface Parse5Location {
  startLine: number;
  startCol: number;
  startOffset: number;
  endLine: number;
  endCol: number;
  endOffset: number;
}
export interface Parse5Element {
  name: string;
  attribs: Record<string, string>;
  sourceCodeLocation?: { startTag?: Parse5Location };
}

/** Given `lit-html/lit-html.js`, the package name `lit-html`. */
const packageOf = (source: string): string =>
  source.split('/', source.startsWith('@') ? 2 : 1).join('/');

/** `name` (a collected local) or `ns.name` (a collected namespace). */
export const references = (
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

/** The tagged-template expression index an element-part attribute addresses. */
export const elementPartIndex = (attribute: string): number | undefined => {
  const match = ELEMENT_PART.exec(attribute);
  return match === null ? undefined : Number(match[1]);
};

/** Own (non-computed) `Property` nodes of an object literal, keyed by name. */
export const propertyNamed = (
  object: ObjectNode,
  name: string,
): PropertyNode | undefined => {
  for (const property of object.properties) {
    if (property.type !== 'Property' || property.computed === true) continue;
    const candidate = property as PropertyNode;
    if ((candidate.key.name ?? candidate.key.value) === name) return candidate;
  }
  return undefined;
};

/** A spread could carry any key, so the whole literal is unknowable. */
export const hasSpread = (object: ObjectNode): boolean =>
  object.properties.some((property) => property.type === 'SpreadElement');

export interface DirectiveTracker {
  /** Feed every `ImportDeclaration`; the tracker owns all per-file state. */
  onImport(node: ListenerNode<'ImportDeclaration'>): void;
  /** Whether `settings.litHtmlSources` gating lets this file be analysed. */
  readonly shouldAnalyse: boolean;
  /** Whether a tagged template's tag is a tracked lit `html`. */
  isLitTemplate(tag: Node): boolean;
  /** Which lit-ui-router directive this expression calls, if any. */
  directiveOf(expression: Node): DirectiveName | undefined;
}

/**
 * Per-file import state, held in the rule's closure and never on
 * `parserServices`: oxlint freezes it, and that mutation was the sole
 * `jsPlugins` blocker (#676).
 */
export const createDirectiveTracker = (
  context: Rule.RuleContext,
): DirectiveTracker => {
  const { litHtmlSources } = context.settings as {
    litHtmlSources?: boolean | string[];
  };
  const sources = new Set([
    ...DEFAULT_LIT_HTML_SOURCES,
    ...(Array.isArray(litHtmlSources) ? litHtmlSources : []),
  ]);
  // Falsy `litHtmlSources` means analyse every bare `html` tag, imported or not.
  let analyse = !litHtmlSources;
  const litHtmlTags = new Set<string>(litHtmlSources ? [] : ['html']);
  const litHtmlNamespaces = new Set<string>();
  const directiveLocals: Record<DirectiveName, Set<string>> = {
    uiSref: new Set(),
    uiSrefActive: new Set(),
  };
  const directiveNamespaces = new Set<string>();

  return {
    onImport(node) {
      const source = node.source.value;
      if (typeof source !== 'string') return;

      // Our directives: the import is what makes a `uiSref` call *ours*.
      if (/^lit-ui-router(\/|$)/.test(source)) {
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            directiveNamespaces.add(specifier.local.name);
          } else if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier'
          ) {
            const imported = specifier.imported.name as DirectiveName;
            if (DIRECTIVE_NAMES.includes(imported)) {
              directiveLocals[imported].add(specifier.local.name);
            }
          }
        }
      }

      analyse =
        // A previous import supplied lit-html
        analyse ||
        // litHtmlSources is falsy -> lint everything
        !litHtmlSources ||
        // litHtmlSources is an Array -> lint only the listed packages
        node.specifiers.some(
          (specifier) =>
            (specifier.type === 'ImportNamespaceSpecifier' ||
              specifier.type === 'ImportSpecifier') &&
            sources.has(packageOf(source)),
        );

      if (!analyse) return;

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

    get shouldAnalyse() {
      return analyse;
    },

    isLitTemplate(tag) {
      return references(tag, litHtmlTags, litHtmlNamespaces, 'html');
    },

    directiveOf(expression) {
      if (expression.type !== 'CallExpression') return undefined;
      const { callee } = expression as CallNode;
      return DIRECTIVE_NAMES.find((name) =>
        references(callee, directiveLocals[name], directiveNamespaces, name),
      );
    },
  };
};
