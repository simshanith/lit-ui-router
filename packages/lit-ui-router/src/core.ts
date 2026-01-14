import {
  forEach,
  isFunction,
  PathNode,
  pick,
  servicesPlugin,
  ServicesPlugin,
  StateObject,
  UIRouter,
  ViewConfig,
  ViewService,
  _ViewDeclaration,
} from '@uirouter/core';
import { html, LitElement } from 'lit';

import {
  RoutedLitElement,
  LitViewDeclaration,
  LitViewDeclarationTemplate,
  NormalizedLitViewDeclaration,
  UIViewInjectedProps,
  LitViewDeclarationElement,
  DefaultResolvesType,
} from './interface.js';

/**
 * Internal counter for generating unique view config IDs.
 * @internal
 */
let viewConfigIdCounter = 0;

/**
 * Configuration for a Lit view instance.
 *
 * This class implements the ViewConfig interface from @uirouter/core
 * and is used internally by the router to manage view configurations.
 *
 * @internal
 */
export class LitViewConfig implements ViewConfig {
  /** Unique identifier for this view config */
  $id: number = viewConfigIdCounter++;
  /** Whether the view configuration has been loaded */
  loaded = true;

  /**
   * Create a new LitViewConfig.
   * @param path - The path nodes for this view
   * @param viewDecl - The view declaration
   */
  constructor(
    public path: PathNode[],
    public viewDecl: _ViewDeclaration,
  ) {}

  /**
   * Load the view configuration.
   * @returns A promise that resolves to this view config
   */
  load() {
    return Promise.resolve(this);
  }
}

/**
 * Type guard to check if a view declaration is a template function.
 *
 * A template function is either:
 * - A function that returns a Lit TemplateResult
 * - A LitElement class that accepts props in its constructor
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
  if (isFunction(config)) {
    if (config.prototype instanceof LitElement) {
      return '_uiViewProps' in config.prototype || config.length === 1;
    }
    return true;
  }
  return false;
}

/**
 * Type guard to check if a component is a RoutedLitElement class.
 *
 * @param component - The component to check
 * @returns True if the component is a LitElement class
 * @internal
 */
export function isRoutedLitElement<
  T extends DefaultResolvesType = DefaultResolvesType,
>(component?: unknown): component is RoutedLitElement<T> {
  return (component as { prototype: unknown })?.prototype instanceof LitElement;
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
>(state: StateObject) {
  const views: Record<string, NormalizedLitViewDeclaration<T>> = {},
    viewsObject = state.views || {
      $default: pick(state, ['component']),
    };

  forEach(viewsObject, function (config: LitViewDeclaration<T>, name: string) {
    let normalizedConfig: NormalizedLitViewDeclaration<T>;
    name = name || '$default'; // Account for views: { "": { template... } }
    if (isLitViewDeclarationTemplate<T>(config)) {
      normalizedConfig = { component: config as LitViewDeclarationTemplate };
    } else {
      normalizedConfig = config as NormalizedLitViewDeclaration<T>;
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

    if (isRoutedLitElement<T>(normalizedConfig.component)) {
      const Component = normalizedConfig.component;
      let component: InstanceType<RoutedLitElement<T>>;
      normalizedConfig.component = (props: UIViewInjectedProps<T>) => {
        component = (Component.sticky && component) || new Component(props);
        component._uiViewProps = props;
        return html`${component}`;
      };
    }

    views[name] = viewsObject[name] = normalizedConfig;
  });
  return views;
}

/**
 * Factory function for creating LitViewConfig instances.
 * @internal
 */
const viewConfigFactory = (path: PathNode[], config: _ViewDeclaration) =>
  new LitViewConfig(path, config);

/**
 * The main router class for Lit applications.
 *
 * UIRouterLit extends the core {@link https://ui-router.github.io/core/docs/latest/classes/_router_.uirouter.html | UIRouter}
 * class from @uirouter/core, adding Lit-specific view handling and component integration.
 *
 * @example Basic usage
 * ```ts
 * import { UIRouterLit } from 'lit-ui-router';
 * import { hashLocationPlugin } from '@uirouter/core';
 *
 * // Create router instance
 * const router = new UIRouterLit();
 *
 * // Add a location plugin (hash-based or push state)
 * router.plugin(hashLocationPlugin);
 *
 * // Register states
 * router.stateRegistry.register({
 *   name: 'home',
 *   url: '/home',
 *   component: HomeComponent
 * });
 *
 * // Start the router
 * router.start();
 * ```
 *
 * @example With push state and base URL
 * ```ts
 * import { UIRouterLit } from 'lit-ui-router';
 * import { pushStateLocationPlugin } from '@uirouter/core';
 *
 * const router = new UIRouterLit();
 * router.plugin(pushStateLocationPlugin);
 *
 * // Configure base URL for push state
 * router.urlService.config.baseHref('/app/');
 *
 * router.start();
 * ```
 *
 * @see {@link https://ui-router.github.io/core/docs/latest/ | UI-Router Core Documentation}
 * @see {@link https://ui-router.github.io/core/docs/latest/classes/_router_.uirouter.html | UIRouter API Reference}
 *
 * @category core
 */
export class UIRouterLit extends UIRouter {
  /**
   * Create a new UIRouterLit instance.
   *
   * The constructor automatically:
   * - Applies the services plugin for browser integration
   * - Registers the Lit view config factory
   * - Decorates the state registry with Lit-specific view building
   */
  constructor() {
    super();
    this.plugin<ServicesPlugin>(servicesPlugin);
    // Apply lit ui-view handling code
    this.viewService._pluginapi._viewConfigFactory('lit', viewConfigFactory);
    this.stateRegistry.decorator('views', litViewsBuilder);
  }

  /** Whether the router has been started */
  private started = false;

  /**
   * Start the router and begin listening for URL changes.
   *
   * This method initializes URL synchronization and begins processing
   * state transitions based on the current URL.
   *
   * @throws {Error} If `start()` has already been called on this router instance
   *
   * @example
   * ```ts
   * const router = new UIRouterLit();
   * router.plugin(hashLocationPlugin);
   * // Register states...
   * router.start(); // Begin routing
   * ```
   */
  start() {
    if (this.started) {
      throw new Error('start() called multiple times');
    }
    this.urlMatcherFactory.$get();
    this.urlService.listen();
    this.urlService.sync();
    this.started = true;
  }
}
