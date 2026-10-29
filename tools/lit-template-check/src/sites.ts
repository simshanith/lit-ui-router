// Finds lit tagged templates and custom element definitions in a TypeScript 7
// AST, and the module the file takes lit's sentinels from.
import {
  isCallExpression,
  isClassDeclaration,
  isDecorator,
  isExportKeyword,
  isIdentifier,
  isPropertyAccessExpression,
  isImportDeclaration,
  isImportSpecifier,
  isNamedImports,
  isNoSubstitutionTemplateLiteral,
  isStringLiteral,
  isTaggedTemplateExpression,
  isTemplateExpression,
  isTemplateTail,
  type CallExpression,
  type ClassDeclaration,
  type Node,
  type SourceFile,
  SyntaxKind,
  type TaggedTemplateExpression,
} from 'typescript/ast';

import type { Span, TemplateSite } from './lower.ts';

const TAGS = new Set(['html', 'svg', 'mathml']);

/** A `@customElement('tag')` class or `customElements.define('tag', Class)` call. */
export interface Definition {
  tag: string;
  className: string;
  exported: boolean;
  topLevel: boolean;
  /** Names from `@fires` or a literal `this.dispatchEvent(new X('name'))`. */
  events: string[];
}

// a text scan of the class, as web-component-analyzer does from the AST
const EVENT_SOURCES =
  /@fires\s+(?:\{[^}]*\}\s+)?([\w:.-]+)|dispatchEvent\(\s*new\s+\w+(?:<[^>]*>)?\(\s*['"]([\w:.-]+)['"]/g;

export interface FileSites {
  sites: TemplateSite[];
  definitions: Definition[];
  /** Module `nothing` resolves from in this file. */
  litModule: string;
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

type ClassFacts = Pick<Definition, 'exported' | 'topLevel' | 'events'>;

/** The tag of a `customElement('tag')` or `customElements.define('tag', …)` call. */
function definedTag(call: CallExpression): string | undefined {
  const [first] = call.arguments;

  return first && isStringLiteral(first) ? first.text : undefined;
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

    const tag = definedTag(call);

    return tag
      ? [{ tag, className, exported: false, topLevel: false, events: [] }]
      : [];
  });
}

function defineCall(node: CallExpression): Definition[] {
  const callee = node.expression;

  if (
    !isPropertyAccessExpression(callee) ||
    callee.name.text !== 'define' ||
    !isIdentifier(callee.expression) ||
    callee.expression.text !== 'customElements'
  ) {
    return [];
  }

  const tag = definedTag(node);
  const second = node.arguments[1];

  return tag && second && isIdentifier(second)
    ? [
        {
          tag,
          className: second.text,
          exported: false,
          topLevel: false,
          events: [],
        },
      ]
    : [];
}

function siteOf(
  node: TaggedTemplateExpression,
  tag: string,
  sourceFile: SourceFile,
): TemplateSite {
  const { template } = node;
  const strings: Span[] = [];
  const expressions: Span[] = [];

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
      expressions.push({
        start: span.expression.getStart(sourceFile),
        end: span.expression.end,
      });
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
  const classes = new Map<string, ClassFacts>();

  const tagOf = (local: string): string | undefined => {
    const [imported, module] = (imports.get(local) ?? '').split('\0');

    if (module?.includes('static-html')) return 'static-html';

    if (imported && TAGS.has(imported)) return imported;

    return TAGS.has(local) ? local : undefined;
  };

  const visit = (node: Node): void => {
    if (isClassDeclaration(node)) {
      definitions.push(...classDefinitions(node, sourceFile, classes));
    } else if (isCallExpression(node)) {
      definitions.push(...defineCall(node));
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

  return { sites, definitions, litModule: litModule ?? 'lit' };
}
