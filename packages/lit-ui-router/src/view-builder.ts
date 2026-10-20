// The `views` state builder `UIRouterLit` registers, and the guard it uses.
import {
  forEach,
  isFunction,
  pick,
  StateObject,
  ViewService,
} from '@uirouter/core';

import type {
  DefaultResolvesType,
  LitViewDeclaration,
  LitViewDeclarationElement,
  LitViewDeclarationTemplate,
  NormalizedLitViewDeclaration,
} from './interface.js';
import {
  isRoutedLitElement,
  routedLitElementRenderer,
} from './routed-element.js';

/**
 * `@uirouter/core` types `forEach` as `any` because it resolves to
 * `angular.forEach || _forEach` at load time. Narrowed to the object-iteration
 * form used here, where the callback receives `(value, key)`.
 * @internal
 */
// SAFETY: both `forEach` implementations call back with `(value, key)` for objects
const forEachValue = forEach as <V>(
  obj: Record<string, V>,
  cb: (value: V, key: string) => void,
) => void;

/**
 * Type guard to check if a view declaration is a template function.
 *
 * A template function is either:
 * - A function that returns a Lit TemplateResult
 * - A LitElement class (constructor props optional — props are also delivered
 *   via the `_uiViewProps` property; see {@link RoutedLitElement})
 *
 * @param config - The view declaration to check
 * @returns True if the config is a template function
 * @internal
 */
export function isLitViewDeclarationTemplate<
  T extends DefaultResolvesType = DefaultResolvesType,
>(
  config: LitViewDeclaration<T>,
): config is LitViewDeclarationTemplate<T> | LitViewDeclarationElement<T> {
  return isFunction(config);
}

/**
 * State builder function for Lit views.
 *
 * When the StateBuilder builds a State object from a raw StateDeclaration, this builder
 * handles the `views` property with logic specific to lit-ui-router.
 *
 * If no `views: {}` property exists on the StateDeclaration, then it creates the `views` object and
 * applies the state-level configuration to a view named `$default`.
 *
 * @param state - The state object being built
 * @returns The normalized views object
 * @internal
 */
export function litViewsBuilder<
  T extends DefaultResolvesType = DefaultResolvesType,
>(state: StateObject): Record<string, NormalizedLitViewDeclaration<T>> {
  const views = new Map<string, NormalizedLitViewDeclaration<T>>(),
    viewsObject = state.views || {
      $default: pick(state, ['component']),
    };

  forEachValue(
    // SAFETY: lit states declare `views` (or a `component`) as lit view declarations
    viewsObject as Record<string, LitViewDeclaration<T>>,
    function (config: LitViewDeclaration<T>, name: string) {
      let normalizedConfig: NormalizedLitViewDeclaration<T>;
      name = name || '$default'; // Account for views: { "": { template... } }

      if (isLitViewDeclarationTemplate<T>(config)) {
        normalizedConfig = { component: config };
      } else {
        normalizedConfig = config;
      }

      if (Object.keys(normalizedConfig || {}).length === 0) return;

      normalizedConfig.$type = 'lit';
      normalizedConfig.$context = state;
      normalizedConfig.$name = name;

      const normalizedTarget = ViewService.normalizeUIViewTarget(
        normalizedConfig.$context,
        normalizedConfig.$name,
      );

      normalizedConfig.$uiViewName = normalizedTarget.uiViewName;
      normalizedConfig.$uiViewContextAnchor =
        normalizedTarget.uiViewContextAnchor;

      // The declaration outlives every `<ui-view>` that renders it, so a renderer
      // held here makes a `sticky` class survive exits. Other classes are left for
      // `<ui-view>` to bind, which resets them when the view config changes.
      if (
        isRoutedLitElement<T>(normalizedConfig.component) &&
        normalizedConfig.component.sticky
      ) {
        normalizedConfig.component = routedLitElementRenderer<T>(
          normalizedConfig.component,
        );
      }

      views.set(name, (viewsObject[name] = normalizedConfig));
    },
  );

  return Object.fromEntries(views);
}
