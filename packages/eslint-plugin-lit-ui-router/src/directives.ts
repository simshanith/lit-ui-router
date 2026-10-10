// Syntax-only, so the rules also load into oxlint jsPlugins (#676).
import type { Rule, Scope, SourceCode } from 'eslint';
import type { Parse5Element } from 'eslint-plugin-lit/lib/util.js';

export type { Parse5Element };

/** The node type eslint hands a listener, without naming `estree` directly. */
type ListenerNode<K extends keyof Rule.NodeListener> = Parameters<
  NonNullable<Rule.NodeListener[K]>
>[0];

// A lit template's element part (`<a ${uiSref('x')}>`) reaches parse5 as a bare
// placeholder, so it parses as a valueless attribute — same shape
// `eslint-plugin-lit`'s `util.isExpressionPlaceholder` matches, but capturing
// the index, which addresses the tagged template's own expressions.
const ELEMENT_PART = /^\{\{__q:(\d+)__\}\}$/i;

// The same placeholder in an attribute *value* (`href=${srefHref('x')}`), which
// is where an attribute part lands. Global, so a value that mixes text and
// expressions is counted rather than only matched.
const ATTRIBUTE_PART = /\{\{__q:(\d+)__\}\}/gi;

// lit's other bindings reach parse5 as attributes too, but a property, event or
// boolean part is not an attribute part and throws the same way.
const BINDING_PREFIX = /^[.?@]/;

/** The lit-html packages the base rule's gating accepts before settings. */
const DEFAULT_LIT_HTML_SOURCES = ['lit-html', 'lit-element', 'lit'];

/** The directives these rules understand. */
export type DirectiveName =
  | 'uiSref'
  | 'uiSrefActive'
  | 'srefHref'
  | 'srefActiveClass'
  | 'srefAriaCurrent';

const DIRECTIVE_NAMES: DirectiveName[] = [
  'uiSref',
  'uiSrefActive',
  'srefHref',
  'srefActiveClass',
  'srefAriaCurrent',
];

/** The reactive controller that hands a host the same status the directives read. */
const STATUS_CONTROLLER = 'SrefStatusController';

/** The elements HTML gives link semantics with no role of their own. */
const NATIVE_LINKS = new Set(['a', 'area']);

/** Every `aria-current` spelling lit binds, as parse5 lowercases attribute keys. */
const ARIA_CURRENT = new Set(['aria-current', '.aria-current', '.ariacurrent']);

/** The import is what makes a `uiSref` call *ours*. */
const LIT_UI_ROUTER = /^lit-ui-router(\/|$)/;

/** Whether an import source is this library's, subpaths included. */
export const isOurPackage = (source: string): boolean =>
  LIT_UI_ROUTER.test(source);

// Minimal views of the two ASTs these rules cross; eslint speaks ESTree and
// parse5 nodes arrive untyped through the analyzer's visitor.
export interface Node {
  type: string;
  range?: [number, number];
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- parse5 nodes arrive untyped; each read narrows the member it needs
  [key: string]: unknown;
}

interface IdentifierNode extends Node {
  name: string;
}

export interface MemberNode extends Node {
  object: Node;
  property: Node;
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

/** An eslint AST node through the `Node` view. */
export const asNode = (node: { type: string }): Node => node;

/** An eslint AST node list through the `Node` view, read-only as the AST's own. */
export const asNodes = (nodes: readonly { type: string }[]): readonly Node[] =>
  nodes;

/** A `Node` back as eslint's own, for the `SourceCode` and fixer APIs. */
// SAFETY: every `Node` these rules hold was read off eslint's AST, never built
export const toEstree = (node: { type: string }): Rule.Node =>
  node as Rule.Node;

// Discriminant checks: a node with ESTree's `type` has ESTree's shape for it.
export const isIdentifier = (
  node: Node | null | undefined,
): node is IdentifierNode => node?.type === 'Identifier';

export const isMemberExpression = (
  node: Node | null | undefined,
): node is MemberNode => node?.type === 'MemberExpression';

export const isCallExpression = (
  node: Node | null | undefined,
): node is CallNode => node?.type === 'CallExpression';

const isNewExpression = (node: Node | null | undefined): node is CallNode =>
  node?.type === 'NewExpression';

export const isObjectExpression = (
  node: Node | null | undefined,
): node is ObjectNode => node?.type === 'ObjectExpression';

const isProperty = (node: Node | null | undefined): node is PropertyNode =>
  node?.type === 'Property';

// Literal values, node names and `settings` entries arrive untyped or as a union.
export const isString = <T>(value: T): value is T & string =>
  typeof value === 'string';

const isBoolean = <T>(value: T): value is T & boolean =>
  typeof value === 'boolean';

/** Given `lit-html/lit-html.js`, the package name `lit-html`. */
const packageOf = (source: string): string =>
  source.split('/', source.startsWith('@') ? 2 : 1).join('/');

/** The definition an identifier resolves to; `undefined` when it is unbound. */
const definitionOf = (
  context: Rule.RuleContext,
  node: Node,
): Scope.Definition | undefined => {
  if (!isIdentifier(node)) return undefined;
  const { name } = node;

  let scope: Scope.Scope | null = context.sourceCode.getScope(toEstree(node));

  for (; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(name);

    if (variable !== undefined) return variable.defs[0];
  }

  return undefined;
};

/** The import an identifier resolves to, or nothing: a shadowing local wins. */
const importBindingOf = (context: Rule.RuleContext, node: Node) => {
  const definition = definitionOf(context, node);

  if (definition?.type !== 'ImportBinding') return undefined;
  const source = definition.parent.source.value;

  if (!isString(source)) return undefined;

  return { node: definition.node, source };
};

/** `name` imported from an accepted source, or `ns.name` with `ns` such a namespace. */
const importedAs = (
  context: Rule.RuleContext,
  node: Node,
  name: string,
  accepts: (source: string) => boolean,
): boolean => {
  if (isIdentifier(node)) {
    const binding = importBindingOf(context, node);

    if (binding?.node.type !== 'ImportSpecifier') return false;

    return (
      binding.node.imported.type === 'Identifier' &&
      binding.node.imported.name === name &&
      accepts(binding.source)
    );
  }

  if (!isMemberExpression(node) || node.computed === true) return false;

  if (node.property.name !== name) return false;
  const binding = importBindingOf(context, node.object);

  return (
    binding?.node.type === 'ImportNamespaceSpecifier' && accepts(binding.source)
  );
};

/** The tagged-template expression index an element-part attribute addresses. */
export const elementPartIndex = (attribute: string): number | undefined => {
  const match = ELEMENT_PART.exec(attribute);

  return match === null ? undefined : Number(match[1]);
};

/** The expression index an attribute value addresses, when it is the whole value. */
export const attributePartIndex = (value: string): number | undefined =>
  elementPartIndex(value);

/** Where an attribute-part expression sits, as lit's part constructors see it. */
export interface AttributePart {
  /** The attribute name, as parse5 reports it (lowercased). */
  name: string;
  /** Whether it is the only expression in the attribute (`strings.length <= 2`). */
  only: boolean;
  /** Whether it is the whole value, with no static text (`strings === undefined`). */
  whole: boolean;
}

/**
 * Every attribute-part expression of an element, keyed by expression index.
 * Element parts are attribute *keys*, and `.prop` / `?bool` / `@event` bindings
 * are their own part types, so neither joins this map.
 */
export const attributePartsOf = (
  element: Parse5Element,
): Map<number, AttributePart> => {
  const parts = new Map<number, AttributePart>();

  for (const [name, value] of Object.entries(element.attribs)) {
    if (elementPartIndex(name) !== undefined) continue;

    if (BINDING_PREFIX.test(name)) continue;

    const indices = [...value.matchAll(ATTRIBUTE_PART)].map((match) =>
      Number(match[1]),
    );

    for (const index of indices) {
      parts.set(index, {
        name,
        only: indices.length === 1,
        whole: attributePartIndex(value) !== undefined,
      });
    }
  }

  return parts;
};

/**
 * Where an attribute's value ends in the raw source, as a fixer range point:
 * past the closing `}` of its **last** expression, past whatever static text
 * follows, and past the closing quote when the value carries one.
 *
 * The last expression, never the matched one, so `class="nav ${a} ${b}"` lands
 * after the quote rather than inside the value.
 */
export const attributeEnd = (
  text: string,
  element: Parse5Element,
  attribute: string,
  expressions: readonly Node[],
): number | undefined => {
  const value = element.attribs[attribute];

  if (value === undefined) return undefined;
  const last = [...value.matchAll(ATTRIBUTE_PART)].at(-1);

  if (last?.index === undefined) return undefined;
  const range = expressions[Number(last[1])]?.range;

  if (range === undefined) return undefined;
  // The expression's own text stops short of the template's `}`.
  const close = text.indexOf('}', range[1]);

  if (close === -1) return undefined;
  // parse5 keeps the static text around the placeholder, so the raw source
  // resumes with it, and the value's quote (if any) follows.
  let end = close + 1 + (value.length - last.index - last[0].length);

  if (text[end] === '"' || text[end] === "'") end += 1;

  return end;
};

/**
 * Whether an element carries link semantics: `<a>`, `<area>`, a literal `role`
 * with the `link` token, or a tag the host declared. A bound `role` is
 * unknowable, so it declares nothing.
 */
export const isLinkElement = (
  element: Parse5Element,
  parts: Map<number, AttributePart>,
  linkElements: ReadonlySet<string>,
): boolean => {
  const bound = [...parts.values()].some((part) => part.name === 'role');
  const role = bound ? undefined : element.attribs.role;

  return (
    NATIVE_LINKS.has(element.name) ||
    linkElements.has(element.name) ||
    role?.split(/\s+/).includes('link') === true
  );
};

/**
 * Whether an `aria-current` is authored at all — literal, bound, or bound to
 * something else entirely. Whether its value is right is nobody's business here.
 */
export const hasAriaCurrent = (element: Parse5Element): boolean =>
  Object.keys(element.attribs).some((key) => ARIA_CURRENT.has(key));

/** Own (non-computed) `Property` nodes of an object literal, keyed by name. */
export const propertyNamed = (
  object: ObjectNode,
  name: string,
): PropertyNode | undefined => {
  for (const property of object.properties) {
    if (!isProperty(property) || property.computed === true) continue;

    if ((property.key.name ?? property.key.value) === name) return property;
  }

  return undefined;
};

/** Named specifiers of every lit-ui-router import in this file. */
const ourSpecifiers = (source: SourceCode) =>
  source.ast.body.flatMap((statement) => {
    if (statement.type !== 'ImportDeclaration') return [];
    const from = statement.source.value;

    if (!isString(from) || !isOurPackage(from)) return [];

    return statement.specifiers.filter(
      (specifier) => specifier.type === 'ImportSpecifier',
    );
  });

/** How a fix spells a lit-ui-router export, and the import edits it needs. */
export interface SiblingBinding {
  binding: string;
  edits: Rule.Fix[];
}

/**
 * Spell `name` the way `callee` reaches lit-ui-router: through the same
 * namespace, an existing specifier, or a specifier added after `callee`'s own.
 * `undefined` when `callee`'s import cannot be found to extend.
 */
export const siblingBinding = (
  fixer: Rule.RuleFixer,
  source: SourceCode,
  callee: Node,
  name: string,
): SiblingBinding | undefined => {
  if (isMemberExpression(callee)) {
    // The same namespace already carries it, so no import to add.
    return {
      binding: `${source.getText(toEstree(callee.object))}.${name}`,
      edits: [],
    };
  }

  const specifiers = ourSpecifiers(source);

  const existing = specifiers.find(
    ({ imported }) => imported.type === 'Identifier' && imported.name === name,
  );

  if (existing !== undefined) {
    return { binding: existing.local.name, edits: [] };
  }

  const anchor = specifiers.find(
    (specifier) => specifier.local.name === callee.name,
  );

  if (anchor === undefined) return undefined;

  return {
    binding: name,
    edits: [fixer.insertTextAfter(anchor, `, ${name}`)],
  };
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
  option?: readonly string[],
): ReadonlySet<string> => {
  const { linkElements } = context.settings;

  const fromSettings: readonly unknown[] = Array.isArray(linkElements)
    ? linkElements
    : [];

  // A host that skips meta.schema can pass a malformed option; it falls back like a malformed setting.
  const declared: readonly unknown[] = Array.isArray(option)
    ? option
    : fromSettings;

  // parse5 lowercases tag names, so a declaration has to meet them there.
  return new Set(
    declared.flatMap((tag) => (isString(tag) ? [tag.toLowerCase()] : [])),
  );
};

/**
 * Whether an element part counts as the work it does at runtime:
 * `settings.allowElementParts`, or a rule's own `allowElementParts` option,
 * which replaces it. Undeclared is `true`, as a live document renders it.
 */
export const allowElementPartsOf = (
  context: Rule.RuleContext,
  option?: boolean,
): boolean => {
  if (isBoolean(option)) return option;

  const { allowElementParts } = context.settings;

  return isBoolean(allowElementParts) ? allowElementParts : true;
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
  /** Whether this expression is `new SrefStatusController(...)`, ours. */
  isControllerNew(expression: Node | null | undefined): boolean;
  /** Whether this identifier's scope definition binds it to such a `new`. */
  isControllerBinding(node: Node): boolean;
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
  const { litHtmlSources } = context.settings;

  const listed: readonly unknown[] = Array.isArray(litHtmlSources)
    ? litHtmlSources
    : [];

  const sources = new Set<unknown>([...DEFAULT_LIT_HTML_SOURCES, ...listed]);

  const isLitSource = (source: string) => sources.has(packageOf(source));
  const isOurs = isOurPackage;
  // Falsy `litHtmlSources` means analyse every bare `html` tag, imported or not.
  let analyse = !litHtmlSources;

  const isControllerNew = (expression: Node | null | undefined): boolean =>
    isNewExpression(expression) &&
    importedAs(context, expression.callee, STATUS_CONTROLLER, isOurs);

  return {
    onImport(node) {
      const source = node.source.value;

      if (!isString(source)) return;
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
      if (!litHtmlSources && isIdentifier(tag) && tag.name === 'html') {
        // unbound or imported from anywhere counts; a shadowing local does not
        const definition = definitionOf(context, tag);

        return definition === undefined || definition.type === 'ImportBinding';
      }

      return importedAs(context, tag, 'html', isLitSource);
    },

    directiveOf(expression) {
      if (!isCallExpression(expression)) return undefined;
      const { callee } = expression;

      return DIRECTIVE_NAMES.find((name) =>
        importedAs(context, callee, name, isOurs),
      );
    },

    isControllerNew,

    isControllerBinding(node) {
      const definition = definitionOf(context, node);

      if (definition?.type !== 'Variable') return false;
      const { init } = definition.node;

      return init != null && isControllerNew(asNode(init));
    },
  };
};
