// Finds lit tagged templates, custom element definitions and decorated
// properties in a TypeScript 7 AST, and the module the file takes lit's
// sentinels from.
import {
  isAbstractKeyword,
  isArrayLiteralExpression,
  isCallExpression,
  isClassDeclaration,
  isClassExpression,
  isDecorator,
  isExportDeclaration,
  isExportKeyword,
  isGetAccessorDeclaration,
  isIdentifier,
  isPropertyAccessExpression,
  isImportDeclaration,
  isImportSpecifier,
  isNamedImports,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isPrivateIdentifier,
  isPrivateKeyword,
  isPropertyAssignment,
  isPropertyDeclaration,
  isProtectedKeyword,
  isReturnStatement,
  isStaticKeyword,
  isStringLiteral,
  isTaggedTemplateExpression,
  isTemplateExpression,
  isTemplateTail,
  type CallExpression,
  type ClassDeclaration,
  type ClassElement,
  type ClassExpression,
  type Expression,
  type Node,
  type SourceFile,
  SyntaxKind,
  type TaggedTemplateExpression,
} from 'typescript-7.1/ast';

import type { Binding, Span, TemplateSite } from './lower.ts';

const TAGS = new Set(['html', 'svg', 'mathml']);

const PROPERTY_DECORATORS = new Set(['property', 'state', 'internalProperty']);

/** A `@customElement('tag')` class or `customElements.define('tag', Class)` call. */
export interface Definition {
  tag: string;
  className: string;
  exported: boolean;
  topLevel: boolean;
  /** Offset of the decorator or `define` call. */
  start: number;
  /** Offset of the tag string. */
  tagStart: number;
  /** Names from `@fires` or a literal `this.dispatchEvent(new X('name'))`. */
  events: string[];
  /** Names from `@slot`; the unnamed slot is ''. */
  slots: string[];
}

/** A class member decorated with `@property`, `@state` or `@internalProperty`. */
export interface Member {
  name: string;
  decorator: string;
  /** Offset of the decorator name. */
  start: number;
  visibility: 'public' | 'protected' | 'private';
  static: boolean;
  abstract: boolean;
  /** The options' `type`, as an identifier or a string literal. */
  type?: { name: string } | { literal: string };
  converter: boolean;
  /** The options' `attribute`, when a string. */
  attribute?: { name: string; start: number };
  /** `attribute: false`. */
  noAttribute: boolean;
  /** Offset of the closing brace of the member's class. */
  classEnd: number;
}

/** A name a class lists in `observedAttributes`. */
export interface ObservedAttribute {
  name: string;
  start: number;
}

// a text scan of the class, as web-component-analyzer does from the AST
const EVENT_SOURCES =
  /@fires\s+(?:\{[^}]*\}\s+)?([\w:.-]+)|dispatchEvent\(\s*new\s+\w+(?:<[^>]*>)?\(\s*['"]([\w:.-]+)['"]/g;

const SLOT_SOURCES = /@slot\b[ \t]*(?:\{[^}]*\}[ \t]*)?(\S*)/g;

export interface FileSites {
  sites: TemplateSite[];
  definitions: Definition[];
  members: Member[];
  observedAttributes: ObservedAttribute[];
  /** Module `nothing` resolves from in this file. */
  litModule: string;
  /** Specifiers of every import and re-export. */
  specifiers: string[];
  /** Specifiers that load a module at runtime: value imports, re-exports and `import()`. */
  runtimeSpecifiers: string[];
  /** Only import and export declarations, which lit-analyzer's import depth skips. */
  facade: boolean;
}

function specifiersOf(sourceFile: SourceFile): string[] {
  return sourceFile.statements.flatMap((statement) =>
    (isImportDeclaration(statement) || isExportDeclaration(statement)) &&
    statement.moduleSpecifier &&
    isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [],
  );
}

/** Value imports and re-exports at the top level, as lit-analyzer follows them. */
function runtimeSpecifiersOf(sourceFile: SourceFile): string[] {
  return sourceFile.statements.flatMap((statement) => {
    const typeOnly = isImportDeclaration(statement)
      ? statement.importClause?.phaseModifier === SyntaxKind.TypeKeyword
      : isExportDeclaration(statement) && statement.isTypeOnly;

    return (isImportDeclaration(statement) || isExportDeclaration(statement)) &&
      !typeOnly &&
      statement.moduleSpecifier &&
      isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : [];
  });
}

/** The specifier of an `import('x')` call, if the node is one. */
function dynamicImport(node: Node): string | undefined {
  if (!isCallExpression(node)) return undefined;

  if (node.expression.kind !== SyntaxKind.ImportKeyword) return undefined;
  const [first] = node.arguments;

  return first &&
    (isStringLiteral(first) || isNoSubstitutionTemplateLiteral(first))
    ? first.text
    : undefined;
}

function importsOf(sourceFile: SourceFile): Map<string, string> {
  const locals = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!isImportDeclaration(statement)) continue;

    if (!isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;

    if (!bindings || !isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      if (!isImportSpecifier(element)) continue;
      const imported = element.propertyName ?? element.name;

      if (isIdentifier(imported)) {
        locals.set(
          element.name.text,
          `${imported.text}\0${statement.moduleSpecifier.text}`,
        );
      }
    }
  }

  return locals;
}

type ClassFacts = Pick<
  Definition,
  'exported' | 'topLevel' | 'events' | 'slots'
>;

const pending = (
  tag: string,
  className: string,
  start: number,
  tagStart: number,
): Definition => ({
  tag,
  className,
  exported: false,
  topLevel: false,
  start,
  tagStart,
  events: [],
  slots: [],
});

/** The tag of a `customElement('tag')` or `customElements.define('tag', …)` call. */
function definedTag(
  call: CallExpression,
  sourceFile: SourceFile,
): { tag: string; tagStart: number } | undefined {
  const [first] = call.arguments;

  return first && isStringLiteral(first)
    ? { tag: first.text, tagStart: first.getStart(sourceFile) }
    : undefined;
}

function visibilityOf(
  name: Node,
  modifiers: readonly Node[],
): Member['visibility'] {
  if (
    isPrivateIdentifier(name) ||
    modifiers.some((modifier) => isPrivateKeyword(modifier))
  ) {
    return 'private';
  }

  return modifiers.some((modifier) => isProtectedKeyword(modifier))
    ? 'protected'
    : 'public';
}

/** `type`, `converter` and `attribute` from a literal options object. */
function optionsOf(
  options: Expression | undefined,
  sourceFile: SourceFile,
): Pick<Member, 'type' | 'converter' | 'attribute' | 'noAttribute'> {
  const facts: Pick<
    Member,
    'type' | 'converter' | 'attribute' | 'noAttribute'
  > = { converter: false, noAttribute: false };

  if (!options || !isObjectLiteralExpression(options)) return facts;

  for (const property of options.properties) {
    if (!isPropertyAssignment(property) || !isIdentifier(property.name)) {
      continue;
    }

    const { initializer } = property;

    switch (property.name.text) {
      case 'type':
        if (isIdentifier(initializer)) facts.type = { name: initializer.text };
        else if (isStringLiteral(initializer)) {
          facts.type = { literal: initializer.text };
        }

        break;
      case 'converter':
        facts.converter = true;
        break;
      case 'attribute':
        if (isStringLiteral(initializer)) {
          facts.attribute = {
            name: initializer.text,
            start: initializer.getStart(sourceFile),
          };
        }

        facts.noAttribute = initializer.kind === SyntaxKind.FalseKeyword;

        break;
    }
  }

  return facts;
}

function memberOf(
  member: ClassElement,
  sourceFile: SourceFile,
  classEnd: number,
): Member[] {
  if (!isPropertyDeclaration(member) && !isGetAccessorDeclaration(member)) {
    return [];
  }

  const name = member.name;

  if (!isIdentifier(name) && !isPrivateIdentifier(name)) return [];
  const modifiers = member.modifiers ?? [];

  return modifiers.flatMap((modifier) => {
    if (!isDecorator(modifier)) return [];
    const call = modifier.expression;

    if (
      !isCallExpression(call) ||
      !isIdentifier(call.expression) ||
      !PROPERTY_DECORATORS.has(call.expression.text)
    ) {
      return [];
    }

    return [
      {
        name: name.text,
        decorator: call.expression.text,
        start: call.expression.getStart(sourceFile),
        visibility: visibilityOf(name, modifiers),
        static: modifiers.some((m) => isStaticKeyword(m)),
        abstract: modifiers.some((m) => isAbstractKeyword(m)),
        ...optionsOf(call.arguments[0], sourceFile),
        classEnd,
      },
    ];
  });
}

/** String literals of a `static observedAttributes` array or getter. */
function observedOf(
  member: ClassElement,
  sourceFile: SourceFile,
): ObservedAttribute[] {
  if (
    !(isPropertyDeclaration(member) || isGetAccessorDeclaration(member)) ||
    !isIdentifier(member.name) ||
    member.name.text !== 'observedAttributes'
  ) {
    return [];
  }

  let list: Expression | undefined;

  if (isPropertyDeclaration(member)) list = member.initializer;
  else {
    const returned = member.body?.statements.find((statement) =>
      isReturnStatement(statement),
    );

    list =
      returned && isReturnStatement(returned) ? returned.expression : undefined;
  }

  if (!list || !isArrayLiteralExpression(list)) return [];

  return list.elements.flatMap((element) =>
    isStringLiteral(element)
      ? [{ name: element.text, start: element.getStart(sourceFile) }]
      : [],
  );
}

function classMembers(
  node: ClassDeclaration | ClassExpression,
  sourceFile: SourceFile,
  members: Member[],
  observed: ObservedAttribute[],
) {
  const classEnd = node.end - 1;

  for (const member of node.members) {
    members.push(...memberOf(member, sourceFile, classEnd));
    observed.push(...observedOf(member, sourceFile));
  }
}

function classDefinitions(
  node: ClassDeclaration,
  sourceFile: SourceFile,
  classes: Map<string, ClassFacts>,
): Definition[] {
  const className = node.name?.text;

  if (!className) return [];

  // pos takes in the leading JSDoc
  const text = sourceFile.text.slice(node.pos, node.end);

  classes.set(className, {
    exported:
      node.modifiers?.some((modifier) => isExportKeyword(modifier)) ?? false,
    topLevel: node.parent.kind === SyntaxKind.SourceFile,
    events: [...text.matchAll(EVENT_SOURCES)].map(
      (match) => match[1] ?? match[2],
    ),
    slots: [...text.matchAll(SLOT_SOURCES)].map(([, name]) =>
      /^[-*]/.test(name) ? '' : name,
    ),
  });

  return (node.modifiers ?? []).flatMap((modifier) => {
    if (!isDecorator(modifier)) return [];
    const call = modifier.expression;

    if (
      !isCallExpression(call) ||
      !isIdentifier(call.expression) ||
      call.expression.text !== 'customElement'
    ) {
      return [];
    }

    const defined = definedTag(call, sourceFile);

    return defined
      ? [
          pending(
            defined.tag,
            className,
            modifier.getStart(sourceFile),
            defined.tagStart,
          ),
        ]
      : [];
  });
}

function defineCall(
  node: CallExpression,
  sourceFile: SourceFile,
): Definition[] {
  const callee = node.expression;

  if (
    !isPropertyAccessExpression(callee) ||
    callee.name.text !== 'define' ||
    !isIdentifier(callee.expression) ||
    callee.expression.text !== 'customElements'
  ) {
    return [];
  }

  const defined = definedTag(node, sourceFile);
  const second = node.arguments[1];

  return defined && second && isIdentifier(second)
    ? [
        pending(
          defined.tag,
          second.text,
          node.getStart(sourceFile),
          defined.tagStart,
        ),
      ]
    : [];
}

/** A binding expression, with its callee and arguments when it calls a name. */
function bindingOf(expression: Expression, sourceFile: SourceFile): Binding {
  const binding: Binding = {
    start: expression.getStart(sourceFile),
    end: expression.end,
  };

  if (isCallExpression(expression) && isIdentifier(expression.expression)) {
    binding.callee = expression.expression.text;
    binding.args = expression.arguments.map((arg) => ({
      start: arg.getStart(sourceFile),
      end: arg.end,
    }));
  }

  return binding;
}

function siteOf(
  node: TaggedTemplateExpression,
  tag: string,
  sourceFile: SourceFile,
): TemplateSite {
  const { template } = node;
  const strings: Span[] = [];
  const expressions: Binding[] = [];

  if (isNoSubstitutionTemplateLiteral(template)) {
    strings.push({
      start: template.getStart(sourceFile) + 1,
      end: template.end - 1,
    });
  } else if (isTemplateExpression(template)) {
    strings.push({
      start: template.head.getStart(sourceFile) + 1,
      end: template.head.end - 2,
    });

    for (const span of template.templateSpans) {
      expressions.push(bindingOf(span.expression, sourceFile));
      strings.push({
        start: span.literal.getStart(sourceFile) + 1,
        end: span.literal.end - (isTemplateTail(span.literal) ? 1 : 2),
      });
    }
  }

  return {
    start: node.getStart(sourceFile),
    end: node.end,
    tag,
    strings,
    expressions,
  };
}

export function findSites(sourceFile: SourceFile): FileSites {
  const imports = importsOf(sourceFile);
  const sites: TemplateSite[] = [];
  const definitions: Definition[] = [];
  const members: Member[] = [];
  const observedAttributes: ObservedAttribute[] = [];
  const dynamicImports: string[] = [];
  const classes = new Map<string, ClassFacts>();

  const tagOf = (local: string): string | undefined => {
    const [imported, module] = (imports.get(local) ?? '').split('\0');

    if (module?.includes('static-html')) return 'static-html';

    if (imported && TAGS.has(imported)) return imported;

    return TAGS.has(local) ? local : undefined;
  };

  const visit = (node: Node): void => {
    const specifier = dynamicImport(node);

    if (specifier !== undefined) dynamicImports.push(specifier);

    if (isClassDeclaration(node)) {
      definitions.push(...classDefinitions(node, sourceFile, classes));
      classMembers(node, sourceFile, members, observedAttributes);
    } else if (isClassExpression(node)) {
      classMembers(node, sourceFile, members, observedAttributes);
    } else if (isCallExpression(node)) {
      definitions.push(...defineCall(node, sourceFile));
    } else if (isTaggedTemplateExpression(node) && isIdentifier(node.tag)) {
      const tag = tagOf(node.tag.text);

      if (tag) sites.push(siteOf(node, tag, sourceFile));
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);

  for (const definition of definitions) {
    Object.assign(definition, classes.get(definition.className));
  }

  const litModule = ['nothing', 'html']
    .map((name) => (imports.get(name) ?? '').split('\0')[1])
    .find((module) => module === 'lit' || module === 'lit-html');

  return {
    sites,
    definitions,
    members,
    observedAttributes,
    litModule: litModule ?? 'lit',
    specifiers: specifiersOf(sourceFile),
    runtimeSpecifiers: [...runtimeSpecifiersOf(sourceFile), ...dynamicImports],
    facade: sourceFile.statements.every(
      (statement) =>
        isImportDeclaration(statement) || isExportDeclaration(statement),
    ),
  };
}
