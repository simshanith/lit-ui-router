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
} from '@uirouter/core';
import { html, LitElement } from 'lit';

import {
  LitViewDeclaration,
  RoutedLitTemplate,
  RoutedLitElement,
  NormalizedLitViewDeclaration,
  UIViewInjectedProps,
} from './interface.js';

/** @internal */
let viewConfigIdCounter = 0;
export class LitViewConfig implements ViewConfig {
  $id: number = viewConfigIdCounter++;
  loaded = true;

  constructor(
    public path: PathNode[],
    public viewDecl: NormalizedLitViewDeclaration,
  ) {}

  load() {
    return Promise.resolve(this);
  }
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

  forEach(viewsObject, function (config: LitViewDeclaration, name: string) {
    name = name || '$default'; // Account for views: { "": { template... } }
    if (isFunction(config)) config = { component: config as RoutedLitTemplate };
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

    if (config.component?.prototype instanceof LitElement) {
      const Component = config.component as RoutedLitElement;
      let component: InstanceType<RoutedLitElement>;
      // @ts-expect-error
      config.component = (props: UIViewInjectedProps) => {
        component = (Component.sticky && component) || new Component(props);
        component._uiViewProps = props;
        return html`${component}`;
      };
    }

    views[name] = viewsObject[name] = config as NormalizedLitViewDeclaration;
  });
  return views;
}

const viewConfigFactory = (
  path: PathNode[],
  config: NormalizedLitViewDeclaration,
) => new LitViewConfig(path, config);

export class UIRouterLit extends UIRouter {
  constructor() {
    super();
    this.plugin<ServicesPlugin>(servicesPlugin);
    // Apply lit ui-view handling code
    // @ts-expect-error
    this.viewService._pluginapi._viewConfigFactory('lit', viewConfigFactory);
    this.stateRegistry.decorator('views', litViewsBuilder);
  }

  private started = false;

  start() {
    if (this.started) {
      throw new Error('start() called multiple times');
    }
    this.started = true;
    this.urlMatcherFactory.$get();
    this.urlService.listen();
    this.urlService.sync();
  }
}
