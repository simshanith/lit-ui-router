/**
 * TypeDoc plugin for lit-ui-router.
 *
 * This plugin handles Lit-specific patterns, adds cross-links to @uirouter/core documentation,
 * and reorganizes output by category (core, components, directives, hooks, types).
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
  RendererEvent,
} from 'typedoc';
import { EXTERNAL_SYMBOLS } from './symbols/index.js';
import * as fs from 'fs';
import * as path from 'path';

const SYMBOL_LINK_REGEX =
  /\[\[([A-Z][a-zA-Z0-9]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\]\]/g;

/**
 * Category definitions for organizing output.
 */
type Category = 'core' | 'components' | 'directives' | 'hooks' | 'types' | 'other';

/**
 * Mapping of symbol names to their categories.
 */
const SYMBOL_CATEGORIES: Record<string, Category> = {
  // Core
  UIRouterLit: 'core',
  // Components
  UIRouterLitElement: 'components',
  UiView: 'components',
  // Directives
  uiSref: 'directives',
  uiSrefActive: 'directives',
  UiSrefDirective: 'directives',
  UiSrefActiveDirective: 'directives',
  // Hooks
  UiOnExit: 'hooks',
  UiOnParamsChanged: 'hooks',
  // Types
  LitStateDeclaration: 'types',
  LitViewDeclaration: 'types',
  LitViewDeclarationElement: 'types',
  LitViewDeclarationObject: 'types',
  LitViewDeclarationTemplate: 'types',
  RoutedLitElement: 'types',
  RoutedLitComponent: 'types',
  RoutedLitTemplate: 'types',
  SrefStatus: 'types',
  UiSrefActiveParams: 'types',
  UIViewInjectedProps: 'types',
  UIViewResolves: 'types',
  UiViewAddress: 'types',
  deregisterFn: 'types',
};

/**
 * Mapping of local symbol names to their category-based paths.
 */
const LOCAL_SYMBOL_PAGES: Record<string, string> = {};

// Build LOCAL_SYMBOL_PAGES from SYMBOL_CATEGORIES
for (const [symbol, category] of Object.entries(SYMBOL_CATEGORIES)) {
  LOCAL_SYMBOL_PAGES[symbol] = `${category}/`;
}

/**
 * Category metadata for index generation.
 */
const CATEGORY_META: Record<Category, { title: string; description: string }> = {
  core: {
    title: 'Core',
    description: 'The main router class for Lit applications.',
  },
  components: {
    title: 'Components',
    description: 'Web components for routing integration.',
  },
  directives: {
    title: 'Directives',
    description: 'Lit directives for navigation and active state styling.',
  },
  hooks: {
    title: 'Hooks',
    description: 'Lifecycle hooks for routed components.',
  },
  types: {
    title: 'Types',
    description: 'TypeScript interfaces and type definitions.',
  },
  other: {
    title: 'Other',
    description: '',
  }
};

/**
 * Build link target URL, handling local vs external links differently.
 */
function buildLinkTarget(
  url: string,
  propertyName: string,
  symbolName: string,
): string {
  const prop = propertyName ? `${propertyName.substring(1)}` : '';

  if (url.startsWith('#')) {
    const folder = LOCAL_SYMBOL_PAGES[symbolName] || '';
    const basePath = `../${folder}${symbolName}`;
    return prop ? `${basePath}#${prop}` : basePath;
  }
  return prop ? `${url}#${prop}` : url;
}

/**
 * Generate anchor HTML, omitting target for local links.
 */
function buildAnchorHtml(href: string, displayName: string): string {
  const isLocal = !href.startsWith('http://') && !href.startsWith('https://');
  if (isLocal) {
    return `<a href="${href}">${displayName}</a>`;
  }
  return `<a href="${href}" target="_blank" rel="noreferrer">${displayName}</a>`;
}

/**
 * Convert flat symbol map to TypeDoc's externalSymbolLinkMappings format.
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
 */
export function load(app: Application): void {
  app.logger.info('[lit-ui-router] Plugin loaded');

  // Get any custom symbol mappings from typedoc.json options
  const customMappings =
    (app.options.getValue('externalSymbolLinkMappings') as Record<
      string,
      Record<string, string>
    >) || {};

  // Merge built-in symbols with custom ones
  const mergedMappings = {
    ...buildExternalSymbolMappings(EXTERNAL_SYMBOLS),
    ...customMappings,
  };

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

  // Post-process output to reorganize by category
  app.renderer.on(RendererEvent.END, (event: RendererEvent) => {
    generateCategoryIndexFiles(event.outputDirectory, app);
    updateSidebarJson(event.outputDirectory, app);
  });
}

/**
 * Generate index.md files for each category.
 */
function generateCategoryIndexFiles(outDir: string, app: Application): void {
  const categories: Category[] = ['core', 'components', 'directives', 'hooks', 'types', 'other'];

  for (const category of categories) {
    const categoryDir = path.join(outDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    const files = fs.readdirSync(categoryDir).filter((f: string) => f.endsWith('.md') && f !== 'index.md');
    if (files.length === 0) continue;

    const meta = CATEGORY_META[category];
    const items = files
      .map((f: string) => {
        const name = path.basename(f, '.md');
        return `- [\`${name}\`](./${name})`;
      })
      .join('\n');

    const next = path.basename(files[0], '.md');
    const indexContent = `---
next:
  text: ${next}
  link: ./${next}
prev:
  text: API Reference
  link: /api/reference
---
# ${meta.title}

${meta.description}

## API

${items}
`;

    fs.writeFileSync(path.join(categoryDir, 'index.md'), indexContent);
    app.logger.verbose(`[lit-ui-router] Generated ${category}/index.md`);
  }
}

/**
 * Update typedoc-sidebar.json with new paths.
 */
function updateSidebarJson(outDir: string, app: Application): void {
  const sidebarPath = path.join(outDir, 'typedoc-sidebar.json');
  if (!fs.existsSync(sidebarPath)) return;
  const sidebar = JSON.parse(fs.readFileSync(sidebarPath, 'utf-8'));
  for (const item of sidebar) {
    const category: Category = item.text;
    item.text = CATEGORY_META[category].title;
    item.link = `/api/reference/${category}`;
    // item.prev = false;
    // item.next = false;
    delete item.collapsed;
    if (category === 'types') {
      item.collapsed = true;
    }
  }

  fs.writeFileSync(sidebarPath, JSON.stringify(sidebar, null, 2));
  app.logger.verbose('[lit-ui-router] Updated typedoc-sidebar.json');
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
 * Recursively link types and their nested children to external documentation.
 */
function linkTypeRecursively(
  type: { type?: string; name?: string; externalUrl?: string; typeArguments?: unknown[]; types?: unknown[]; elementType?: unknown },
  symbolMap: Record<string, string>,
): void {
  if (!type) return;

  // Link the type itself if it's a reference
  if (type.type === 'reference' && type.name && symbolMap[type.name]) {
    type.externalUrl = symbolMap[type.name];
  }

  // Recurse into type arguments (for generics like DirectiveResult<T>)
  if (type.typeArguments) {
    for (const arg of type.typeArguments) {
      linkTypeRecursively(arg as typeof type, symbolMap);
    }
  }

  // Recurse into union/intersection types
  if (type.types) {
    for (const t of type.types) {
      linkTypeRecursively(t as typeof type, symbolMap);
    }
  }

  // Recurse into array element types
  if (type.elementType) {
    linkTypeRecursively(type.elementType as typeof type, symbolMap);
  }
}

/**
 * Link types in a reflection to external documentation.
 */
function linkReflectionTypes(
  reflection: DeclarationReflection,
  symbolMap: Record<string, string>,
): void {
  // Handle signatures (return types, parameters)
  if (reflection.signatures) {
    for (const sig of reflection.signatures) {
      if (sig.type) {
        linkTypeRecursively(sig.type as Parameters<typeof linkTypeRecursively>[0], symbolMap);
      }

      if (sig.parameters) {
        for (const param of sig.parameters) {
          if (param.type) {
            linkTypeRecursively(param.type as Parameters<typeof linkTypeRecursively>[0], symbolMap);
          }
        }
      }
    }
  }

  // Handle direct type on reflection
  if (reflection.type) {
    linkTypeRecursively(reflection.type as Parameters<typeof linkTypeRecursively>[0], symbolMap);
  }

  // Handle extends clauses
  const reflectionWithExtends = reflection as DeclarationReflection & { extendedTypes?: unknown[] };
  if (reflectionWithExtends.extendedTypes) {
    for (const extType of reflectionWithExtends.extendedTypes) {
      linkTypeRecursively(extType as Parameters<typeof linkTypeRecursively>[0], symbolMap);
    }
  }

  // Handle implemented interfaces
  const reflectionWithImpl = reflection as DeclarationReflection & { implementedTypes?: unknown[] };
  if (reflectionWithImpl.implementedTypes) {
    for (const implType of reflectionWithImpl.implementedTypes) {
      linkTypeRecursively(implType as Parameters<typeof linkTypeRecursively>[0], symbolMap);
    }
  }
}

/**
 * Handle [[SymbolName]] links in JSDoc comments.
 */
function handleSymbolLinks(context: Context, app: Application): void {
  const customMappings =
    (app.options.getValue('externalSymbolLinkMappings') as Record<
      string,
      Record<string, string>
    >) || {};
  const symbolMap: Record<string, string> = { ...EXTERNAL_SYMBOLS };

  for (const key in customMappings) {
    symbolMap[key] = customMappings[key][''] || '';
  }

  const visitReflection = (reflection: Reflection): void => {
    if (reflection instanceof DeclarationReflection && reflection.signatures) {
      for (const sig of reflection.signatures) {
        if (sig.comment) {
          processComment(sig.comment, symbolMap);
        }
      }
    }

    if (reflection instanceof DeclarationReflection && reflection.comment) {
      processComment(reflection.comment, symbolMap);
    }

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
): void {
  const processText = (text: string): string => {
    if (!SYMBOL_LINK_REGEX.test(text)) return text;

    return text.replace(SYMBOL_LINK_REGEX, (_match, symbolName: string) => {
      const dotIndex = symbolName.indexOf('.');
      const baseName = dotIndex === -1 ? symbolName : symbolName.substring(0, dotIndex);
      const propertyName = dotIndex === -1 ? '' : symbolName.substring(dotIndex);

      if (symbolMap.hasOwnProperty(baseName)) {
        const url = symbolMap[baseName];
        const displayName = propertyName ? `${symbolName}` : symbolName;
        const linkTarget = buildLinkTarget(url, propertyName, baseName);
        return buildAnchorHtml(linkTarget, displayName);
      }

      if (LOCAL_SYMBOL_PAGES.hasOwnProperty(baseName)) {
        const folder = LOCAL_SYMBOL_PAGES[baseName];
        const prop = propertyName ? `${propertyName.substring(1)}` : '';
        const basePath = `../${folder}${baseName}`;
        const href = prop ? `${basePath}#${prop}` : basePath;
        return `<a href="${href}">${symbolName}</a>`;
      }

      return symbolName;
    });
  };

  if (comment.summary) {
    for (const content of comment.summary) {
      if (content.text) {
        content.text = processText(content.text);
      }
    }
  }

  if (comment.blockTags) {
    for (const blockTag of comment.blockTags) {
      for (const content of blockTag.content) {
        if (content.text) {
          content.text = processText(content.text);
        }
      }
    }
  }
}

/**
 * Handle Lit directive wrapper patterns.
 */
function handleDirectiveWrappers(context: Context, app: Application): void {
  const project = context.project;
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
 */
function addCategoryTags(reflection: DeclarationReflection): void {
  const name = reflection.name;
  const category = SYMBOL_CATEGORIES[name];

  if (category) {
    setCategory(reflection, category);
  }
}

/**
 * Set the category for a reflection.
 */
function setCategory(reflection: DeclarationReflection, category: string): void {
  if (!reflection.comment) {
    return;
  }

  const hasCategory = reflection.comment.blockTags?.some(
    (tag: CommentTag) => tag.tag === '@category',
  );

  if (!hasCategory) {
    reflection.comment.blockTags = reflection.comment.blockTags || [];
    const tag = new CommentTag('@category', [{ kind: 'text', text: category }]);
    reflection.comment.blockTags.push(tag);
  }
}
