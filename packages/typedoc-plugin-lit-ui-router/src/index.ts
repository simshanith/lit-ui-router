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
  CommentTag,
} from 'typedoc';

/**
 * Load the lit-ui-router TypeDoc plugin.
 *
 * @param app - The TypeDoc application instance
 */
export function load(app: Application): void {
  // Log plugin load
  app.logger.info('[lit-ui-router] Plugin loaded');

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
      app.logger.verbose(
        `[lit-ui-router] Linking ${name} to ${name}Directive`,
      );
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
