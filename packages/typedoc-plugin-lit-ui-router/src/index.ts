/**
 * TypeDoc plugin for lit-ui-router.
 *
 * This plugin handles Lit-specific patterns and adds cross-links to @uirouter/core documentation.
 *
 * @packageDocumentation
 */

import {
  Application,
  Converter,
  Context,
  DeclarationReflection,
  Reflection,
  Comment,
  CommentTag,
} from 'typedoc';
import { EXTERNAL_SYMBOLS } from './symbols/index.js';

const SYMBOL_LINK_REGEX =
  /\[\[([A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\]\]/g;

/**
 * Build link target URL, handling local vs external links differently.
 * - Local anchors: #symbolname.property
 * - External links: url#property
 */
function buildLinkTarget(url: string, propertyName: string): string {
  if (!propertyName) return url;
  const prop = propertyName.substring(1);
  if (url.startsWith('#')) {
    return `${url}.${prop}`;
  }
  return `${url}#${prop}`;
}

/**
 * Generate anchor HTML, omitting target for local links.
 */
function buildAnchorHtml(href: string, displayName: string): string {
  const isLocal = href.startsWith('#');
  if (isLocal) {
    return `<a href="${href}">${displayName}</a>`;
  }
  return `<a href="${href}" target="_blank" rel="noreferrer">${displayName}</a>`;
}

/**
 * Convert flat symbol map to TypeDoc's externalSymbolLinkMappings format.
 *
 * TypeDoc expects: { 'SymbolName': { '': 'url', '.property': 'url#property' } }
 */
function buildExternalSymbolMappings(
  symbolMap: Record<string, string>,
): Record<string, Record<string, string>> {
  const mappings: Record<string, Record<string, string>> = {};

  for (const [symbolName, url] of Object.entries(symbolMap)) {
    if (!mappings[symbolName]) {
      mappings[symbolName] = {};
    }
    mappings[symbolName][''] = url;
  }

  return mappings;
}

/**
 * Load the lit-ui-router TypeDoc plugin.
 *
 * @param app - The TypeDoc application instance
 */
export function load(app: Application): void {
  // Log plugin load
  app.logger.info('[lit-ui-router] Plugin loaded');

  // Get any custom symbol mappings from typedoc.json options
  const customMappings =
    (app.options.getValue('externalSymbolLinkMappings') as Record<
      string,
      Record<string, string>
    >) || {};

  // Merge built-in symbols with custom ones (custom takes precedence)
  const mergedMappings = {
    ...buildExternalSymbolMappings(EXTERNAL_SYMBOLS),
    ...customMappings,
  };

  // Set the merged mappings for TypeDoc to use
  app.options.setValue('externalSymbolLinkMappings', mergedMappings);

  // Handle [[SymbolName]] link conversion
  app.converter.on(Converter.EVENT_RESOLVE_END, (context: Context) => {
    handleSymbolLinks(context, app);
  });

  // Handle typed parameter linking
  app.converter.on(Converter.EVENT_RESOLVE_END, (context: Context) => {
    handleTypeLinks(context);
  });

  // Handle directive wrapper patterns
  app.converter.on(Converter.EVENT_RESOLVE_END, (context: Context) => {
    handleDirectiveWrappers(context, app);
  });

  // Add category tags to reflections
  app.converter.on(
    Converter.EVENT_RESOLVE,
    (_context: Context, reflection: Reflection) => {
      if (reflection instanceof DeclarationReflection) {
        addCategoryTags(reflection);
      }
    },
  );
}

/**
 * Link typed parameters and return types to known external symbols.
 */
function handleTypeLinks(context: Context): void {
  const symbolMap: Record<string, string> = EXTERNAL_SYMBOLS;

  const visitReflection = (reflection: Reflection): void => {
    if (reflection instanceof DeclarationReflection) {
      linkReflectionTypes(reflection, symbolMap);
    }

    // Recurse into children
    if ('children' in reflection) {
      const withChildren = reflection as { children?: Reflection[] };
      if (withChildren.children) {
        for (const child of withChildren.children) {
          visitReflection(child);
        }
      }
    }
  };

  visitReflection(context.project);
}

/**
 * Link types in a reflection to external documentation.
 */
function linkReflectionTypes(
  reflection: DeclarationReflection,
  symbolMap: Record<string, string>,
): void {
  // Handle signatures (functions/methods)
  if (reflection.signatures) {
    for (const sig of reflection.signatures) {
      // Process return type
      if (sig.type && sig.type.type === 'reference') {
        const typeName = sig.type.name;
        if (symbolMap.hasOwnProperty(typeName)) {
          sig.type.externalUrl = symbolMap[typeName];
        }
      }

      // Process parameters
      if (sig.parameters) {
        for (const param of sig.parameters) {
          if (param.type && param.type.type === 'reference') {
            const typeName = param.type.name;
            if (symbolMap.hasOwnProperty(typeName)) {
              param.type.externalUrl = symbolMap[typeName];
            }
          }
        }
      }
    }
  }

  // Handle property/field types
  if (reflection.type && reflection.type.type === 'reference') {
    const typeName = reflection.type.name;
    if (symbolMap.hasOwnProperty(typeName)) {
      reflection.type.externalUrl = symbolMap[typeName];
    }
  }
}

/**
 * Handle [[SymbolName]] links in JSDoc comments.
 *
 * Converts [[SymbolName]] to {@link url | SymbolName} for external documentation.
 * Also links typed parameters to known symbols.
 */
function handleSymbolLinks(context: Context, app: Application): void {
  const customMappings =
    (app.options.getValue('externalSymbolLinkMappings') as Record<
      string,
      Record<string, string>
    >) || {};
  const symbolMap: Record<string, string> = { ...EXTERNAL_SYMBOLS };

  // Flatten custom mappings
  for (const key in customMappings) {
    symbolMap[key] = customMappings[key][''] || '';
  }

  const visitReflection = (reflection: Reflection): void => {
    // Process signature comments (for methods on interfaces)
    if (reflection instanceof DeclarationReflection && reflection.signatures) {
      for (const sig of reflection.signatures) {
        if (sig.comment) {
          processComment(sig.comment, symbolMap, app);
        }
      }
    }

    // Process declaration comments
    if (reflection instanceof DeclarationReflection && reflection.comment) {
      processComment(reflection.comment, symbolMap, app);
    }

    // Recurse into children
    if ('children' in reflection) {
      const withChildren = reflection as { children?: Reflection[] };
      if (withChildren.children) {
        for (const child of withChildren.children) {
          visitReflection(child);
        }
      }
    }
  };

  visitReflection(context.project);
}

/**
 * Process a comment object and convert [[SymbolName]] patterns.
 */
function processComment(
  comment: Comment,
  symbolMap: Record<string, string>,
  _app: Application,
): void {
  // Process summary
  if (comment.summary) {
    for (const content of comment.summary) {
      if (content.text && SYMBOL_LINK_REGEX.test(content.text)) {
        content.text = content.text.replace(
          SYMBOL_LINK_REGEX,
          (_match, symbolName: string) => {
            const dotIndex = symbolName.indexOf('.');
            const baseName =
              dotIndex === -1 ? symbolName : symbolName.substring(0, dotIndex);
            const propertyName =
              dotIndex === -1 ? '' : symbolName.substring(dotIndex);

            if (symbolMap.hasOwnProperty(baseName)) {
              const url = symbolMap[baseName];
              const displayName = propertyName ? `${symbolName}` : symbolName;
              const linkTarget = buildLinkTarget(url, propertyName);
              return buildAnchorHtml(linkTarget, displayName);
            }

            // Unknown symbol - use local anchor
            return `<a href="#${symbolName.toLowerCase()}">${symbolName}</a>`;
          },
        );
      }
    }
  }

  // Process block tags (like @returns, @param descriptions)
  if (comment.blockTags) {
    for (const blockTag of comment.blockTags) {
      for (const content of blockTag.content) {
        if (content.text && SYMBOL_LINK_REGEX.test(content.text)) {
          content.text = content.text.replace(
            SYMBOL_LINK_REGEX,
            (_match, symbolName: string) => {
              const dotIndex = symbolName.indexOf('.');
              const baseName =
                dotIndex === -1
                  ? symbolName
                  : symbolName.substring(0, dotIndex);
              const propertyName =
                dotIndex === -1 ? '' : symbolName.substring(dotIndex);

              if (symbolMap.hasOwnProperty(baseName)) {
                const url = symbolMap[baseName];
                const displayName = propertyName ? `${symbolName}` : symbolName;
                const linkTarget = buildLinkTarget(url, propertyName);
                return buildAnchorHtml(linkTarget, displayName);
              }

              // Unknown symbol - use local anchor
              return `<a href="#${symbolName.toLowerCase()}">${symbolName}</a>`;
            },
          );
        }
      }
    }
  }
}

/**
 * Handle Lit directive wrapper patterns.
 *
 * The `directive()` function from Lit wraps directive classes, which can obscure
 * the documentation. This handler links directive exports to their underlying classes.
 */
function handleDirectiveWrappers(context: Context, app: Application): void {
  const project = context.project;

  // Find directive exports and link them to their classes
  const directiveNames = ['uiSref', 'uiSrefActive'];

  for (const name of directiveNames) {
    const directive = project.getChildByName(name);
    const directiveClass = project.getChildByName(`${name}Directive`);

    if (
      directive &&
      directive instanceof DeclarationReflection &&
      directiveClass
    ) {
      app.logger.verbose(`[lit-ui-router] Linking ${name} to ${name}Directive`);
    }
  }
}

/**
 * Add category tags to reflections for better organization.
 *
 * Categories:
 * - Core: UIRouterLit
 * - Components: UIRouterElement, UIViewElement
 * - Directives: uiSref, uiSrefActive
 * - Types: LitStateDeclaration, UIViewInjectedProps, etc.
 * - Hooks: UiOnExit, UiOnParamsChanged
 */
function addCategoryTags(reflection: DeclarationReflection): void {
  const name = reflection.name;

  // Core
  if (name === 'UIRouterLit') {
    setCategory(reflection, 'Core');
  }
  // Components
  else if (name === 'UIRouterElement' || name === 'UIViewElement') {
    setCategory(reflection, 'Components');
  }
  // Directives
  else if (
    name === 'uiSref' ||
    name === 'uiSrefActive' ||
    name === 'UiSrefDirective' ||
    name === 'UiSrefActiveDirective'
  ) {
    setCategory(reflection, 'Directives');
  }
  // Hooks
  else if (name === 'UiOnExit' || name === 'UiOnParamsChanged') {
    setCategory(reflection, 'Hooks');
  }
  // Types (interfaces, type aliases)
  else if (
    name === 'LitStateDeclaration' ||
    name === 'UIViewInjectedProps' ||
    name === 'RoutedLitTemplate' ||
    name === 'RoutedLitElement' ||
    name === 'SrefStatus' ||
    name === 'UiSrefActiveParams'
  ) {
    setCategory(reflection, 'Types');
  }
}

/**
 * Set the category for a reflection.
 */
function setCategory(
  reflection: DeclarationReflection,
  category: string,
): void {
  if (!reflection.comment) {
    return;
  }

  // Check if category tag already exists
  const hasCategory = reflection.comment.blockTags?.some(
    (tag: CommentTag) => tag.tag === '@category',
  );

  if (!hasCategory) {
    reflection.comment.blockTags = reflection.comment.blockTags || [];
    // Create a new CommentTag using the constructor
    const tag = new CommentTag('@category', [{ kind: 'text', text: category }]);
    reflection.comment.blockTags.push(tag);
  }
}
