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
import { property } from 'lit/decorators.js';

import {
  IRoutedLitElement,
  LitViewDeclaration,
  LitViewDeclarationTemplate,
  NormalizedLitViewDeclaration,
  UIViewInjectedProps,
  IRoutedLitElementConstructor,
} from './interface.js';

/** @internal */
let viewConfigIdCounter = 0;
export class LitViewConfig implements ViewConfig {
  $id: number = viewConfigIdCounter++;
  loaded = true;

  constructor(
    public path: PathNode[],
    public viewDecl: _ViewDeclaration,
  ) {}

  load() {
    return Promise.resolve(this);
  }
}

export function isLitViewDeclarationTemplate(
  config: LitViewDeclaration,
): config is LitViewDeclarationTemplate {
  return isFunction(config);
}

export function isRoutedLitElement(
  component?: unknown,
): component is IRoutedLitElementConstructor {
  return (component as { prototype: unknown })?.prototype instanceof LitElement;
}

export class RoutedLitElement extends LitElement implements IRoutedLitElement {
  @property({ attribute: false })
  _uiViewProps?: UIViewInjectedProps;

  static sticky?: boolean;
}

/**
 * This is a [[StateBuilder.builder]] function for lit `views`.
 *
 * When the [[StateBuilder]] builds a [[State]] object from a raw [[StateDeclaration]], this builder
 * handles the `views` property with logic specific to lit-ui-router.
 *
 * If no `views: {}` property exists on the [[StateDeclaration]], then it creates the `views` object and
 * applies the state-level configuration to a view named `$default`.
 */
export function litViewsBuilder(state: StateObject) {
  const views: Record<string, NormalizedLitViewDeclaration> = {},
    viewsObject = state.views || {
      $default: pick(state, ['component']),
    };

  forEach(
    viewsObject,
    function (config: NormalizedLitViewDeclaration, name: string) {
      name = name || '$default'; // Account for views: { "": { template... } }
      if (isLitViewDeclarationTemplate(config)) config = { component: config };
      if (Object.keys(config || {}).length === 0) return;

      config.$type = 'lit';
      config.$context = state;
      config.$name = name;

      const normalized = ViewService.normalizeUIViewTarget(
        config.$context,
        config.$name,
      );
      config.$uiViewName = normalized.uiViewName;
      config.$uiViewContextAnchor = normalized.uiViewContextAnchor;

      if (isRoutedLitElement(config.component)) {
        const Component = config.component;
        let component: RoutedLitElement;
        config.component = (props: UIViewInjectedProps) => {
          component = (Component.sticky && component) || new Component();
          component._uiViewProps = props;
          return html`${component}`;
        };
      }

      views[name] = viewsObject[name] = config;
    },
  );
  return views;
}

const viewConfigFactory = (path: PathNode[], config: _ViewDeclaration) =>
  new LitViewConfig(path, config);

export class UIRouterLit extends UIRouter {
  constructor() {
    super();
    this.plugin<ServicesPlugin>(servicesPlugin);
    // Apply lit ui-view handling code
    this.viewService._pluginapi._viewConfigFactory('lit', viewConfigFactory);
    this.stateRegistry.decorator('views', litViewsBuilder);
  }

  private started = false;

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
