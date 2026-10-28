import {
  PathNode,
  servicesPlugin,
  ServicesPlugin,
  UIRouter,
  ViewConfig,
  _ViewDeclaration,
} from '@uirouter/core';

import { litViewsBuilder } from './view-builder.js';

export { isRoutedLitElement } from './routed-element.js';

export {
  /**
   * @internal
   * @deprecated View-builder plumbing, not a supported import (#541).
   */
  isLitViewDeclarationTemplate,
  /**
   * @internal
   * @deprecated View-builder plumbing, not a supported import (#541).
   */
  litViewsBuilder,
} from './view-builder.js';

/**
 * Internal counter for generating unique view config IDs.
 * @internal
 */
let viewConfigIdCounter = 0;

/**
 * The view config {@link UIRouterLit} builds for each lit view declaration,
 * implementing `@uirouter/core`'s `ViewConfig`.
 *
 * `<ui-view>` renders a view only when its config is a `LitViewConfig`; a
 * renderer that draws lit views outside `<ui-view>` makes the same
 * `instanceof` check before it reads `viewDecl`.
 *
 * @category core
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
  load(): Promise<this> {
    return Promise.resolve(this);
  }
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
 * UIRouterLit extends the core {@link UIRouter}
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
 * @see {@link UIRouter | UIRouter API Reference}
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
  start(): void {
    if (this.started) {
      throw new Error('start() called multiple times');
    }

    // eslint-disable-next-line typescript/no-deprecated -- $get() flushes the param-type queue; kept deliberately over the @internal flush
    this.urlMatcherFactory.$get();
    this.urlService.listen();
    this.urlService.sync();
    this.started = true;
  }
}
