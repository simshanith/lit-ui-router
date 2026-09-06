// Syntax-only, so the rules also load into oxlint jsPlugins (#676).
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

/** The import is what makes a `uiSref` call *ours*. */
const LIT_UI_ROUTER = /^lit-ui-router(\/|$)/;

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

/** The eslint-scope surface these rules read; oxlint `jsPlugins` bundles the same. */
interface ScopeLike {
  set: Map<string, { defs: DefinitionLike[] }>;
  upper: ScopeLike | null;
}
interface DefinitionLike {
  type: string;
  node: Node;
  parent?: Node & { source?: { value?: unknown } };
}
interface ImportBinding {
  node: Node & { local: { name: string }; imported?: Node & { name?: string } };
  source: string;
}

/** The definition an identifier resolves to; `undefined` when it is unbound. */
const definitionOf = (
  context: Rule.RuleContext,
  node: Node,
): DefinitionLike | undefined => {
  if (node.type !== 'Identifier') return undefined;
  const name = (node as { name?: string }).name;
  if (name === undefined) return undefined;
  let scope: ScopeLike | null = context.sourceCode.getScope(
    node as never,
  ) as unknown as ScopeLike;
  for (; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable !== undefined) return variable.defs[0];
  }
  return undefined;
};

/** The import an identifier resolves to, or nothing: a shadowing local wins. */
const importBindingOf = (
  context: Rule.RuleContext,
  node: Node,
): ImportBinding | undefined => {
  const definition = definitionOf(context, node);
  const source = definition?.parent?.source?.value;
  if (definition?.type !== 'ImportBinding' || typeof source !== 'string') {
    return undefined;
  }
  return { node: definition.node as ImportBinding['node'], source };
};

/** `name` imported from an accepted source, or `ns.name` with `ns` such a namespace. */
const importedAs = (
  context: Rule.RuleContext,
  node: Node,
  name: string,
  accepts: (source: string) => boolean,
): boolean => {
  if (node.type === 'Identifier') {
    const binding = importBindingOf(context, node);
    if (binding?.node.type !== 'ImportSpecifier') return false;
    return (
      binding.node.imported?.type === 'Identifier' &&
      binding.node.imported.name === name &&
      accepts(binding.source)
    );
  }
  if (node.type !== 'MemberExpression' || node.computed === true) return false;
  const property = (node.property as { name?: string } | undefined)?.name;
  if (property !== name) return false;
  const binding = importBindingOf(context, node.object as Node);
  return (
    binding?.node.type === 'ImportNamespaceSpecifier' && accepts(binding.source)
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

/**
 * The tags a host has declared to be link elements: `settings.linkElements`,
 * or a rule's own `linkElements` option, which replaces it wholesale (#676).
 * Undeclared stays undeclared — no declaration, no behaviour change.
 */
export const linkElementsOf = (
  context: Rule.RuleContext,
  option?: unknown,
): ReadonlySet<string> => {
  const { linkElements } = context.settings as { linkElements?: unknown };
  const declared = Array.isArray(option)
    ? option
    : Array.isArray(linkElements)
      ? linkElements
      : [];
  // parse5 lowercases tag names, so a declaration has to meet them there.
  return new Set(
    declared
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.toLowerCase()),
  );
};

/** The shared `linkElements` option, identical in every rule that reads it. */
export const LINK_ELEMENTS_SCHEMA = {
  description:
    'Element tags to treat as link elements, replacing `settings.linkElements` for this rule.',
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true,
} as const;

export interface DirectiveTracker {
  /** Feed every `ImportDeclaration`; it drives the `litHtmlSources` file gate. */
  onImport(node: ListenerNode<'ImportDeclaration'>): void;
  /** Whether `settings.litHtmlSources` gating lets this file be analysed. */
  readonly shouldAnalyse: boolean;
  /** Whether a tagged template's tag resolves to a lit `html`. */
  isLitTemplate(tag: Node): boolean;
  /** Which lit-ui-router directive this expression calls, if any. */
  directiveOf(expression: Node): DirectiveName | undefined;
}

/**
 * Per-file gate state, held in the rule's closure and never on
 * `parserServices`: oxlint freezes it, and that mutation was the sole
 * `jsPlugins` blocker (#676). Tags and directives resolve through scope, so a
 * shadowing parameter or local is never mistaken for the import.
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
  const isLitSource = (source: string) => sources.has(packageOf(source));
  const isOurs = (source: string) => LIT_UI_ROUTER.test(source);
  // Falsy `litHtmlSources` means analyse every bare `html` tag, imported or not.
  let analyse = !litHtmlSources;

  return {
    onImport(node) {
      const source = node.source.value;
      if (typeof source !== 'string') return;
      analyse =
        // A previous import supplied lit-html
        analyse ||
        // litHtmlSources is an Array -> lint only the listed packages
        node.specifiers.some(
          (specifier) =>
            (specifier.type === 'ImportNamespaceSpecifier' ||
              specifier.type === 'ImportSpecifier') &&
            isLitSource(source),
        );
    },

    get shouldAnalyse() {
      return analyse;
    },

    isLitTemplate(tag) {
      if (
        !litHtmlSources &&
        tag.type === 'Identifier' &&
        (tag as { name?: string }).name === 'html'
      ) {
        // unbound or imported from anywhere counts; a shadowing local does not
        const definition = definitionOf(context, tag);
        return definition === undefined || definition.type === 'ImportBinding';
      }
      return importedAs(context, tag, 'html', isLitSource);
    },

    directiveOf(expression) {
      if (expression.type !== 'CallExpression') return undefined;
      const { callee } = expression as CallNode;
      return DIRECTIVE_NAMES.find((name) =>
        importedAs(context, callee, name, isOurs),
      );
    },
  };
};
