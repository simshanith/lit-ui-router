// The view registration `<ui-view>` and `UiViewController` share: the ActiveUIView, its hooks, and the component a config routes.
import {
  type ActiveUIView,
  filter,
  isFunction,
  type Param,
  type PathNode,
  type RawParams,
  ResolveContext,
  type StateDeclaration,
  type StateObject,
  type Transition,
  type UIRouter,
  unnestR,
  type ViewConfig,
} from '@uirouter/core';

import { isRoutedLitElement } from './core.js';
import { warnForeignClass } from './dev-warn.js';
import type { ParentView } from './events.js';
import type {
  NormalizedLitViewDeclaration,
  RoutedLitTemplate,
  UiOnExit,
  UiOnParamsChanged,
} from './interface.js';
import { routedLitElementRenderer } from './routed-element.js';

/** @internal */
export type DeregisterFn = () => void;

let viewIdCounter = 0;

/**
 * The next view registration id, unique across `<ui-view>`s and controllers.
 *
 * @internal
 */
export const nextViewId = (): number => viewIdCounter++;

/**
 * What a view registration reads off whatever renders it: the routed element
 * its component hooks live on, and the update that re-renders it.
 *
 * @internal
 */
export interface ViewTarget {
  readonly routedElement: Element | null;
  requestUpdate(): void;
}

/** @internal */
export interface ViewRegistrationOptions {
  id: number;
  /** the view name; empty selects `$default` */
  name: string;
  parentView: ParentView | null;
  router: UIRouter | undefined;
  configUpdated: (config: ViewConfig) => void;
}

/**
 * Builds the `ActiveUIView` a view registers, named under its parent view and
 * created in the parent's context, or the root state's at the top.
 *
 * @internal
 */
export const createViewRegistration = ({
  id,
  name,
  parentView,
  router,
  configUpdated,
}: ViewRegistrationOptions): ActiveUIView => {
  const viewName = name || '$default';
  const parentFqn = parentView?.fqn;

  const registration: Omit<ActiveUIView, 'config' | 'creationContext'> &
    Partial<Pick<ActiveUIView, 'config' | 'creationContext'>> = {
    $type: 'lit',
    id,
    name: viewName,
    fqn: parentFqn ? parentFqn + '.' + viewName : viewName,
    creationContext: parentView?.viewContext || router?.stateRegistry.root(),
    configUpdated,
    config: undefined,
  };

  // SAFETY: ui-router calls `configUpdated` with a config before anything reads `config`; a routerless view never registers
  return registration as ActiveUIView;
};

/** The state that declared the view `registration` holds. */
const viewState = (registration: ActiveUIView): StateDeclaration =>
  // SAFETY: a lit view's `$context` is the StateObject that declared it
  (registration.config.viewDecl.$context as StateObject).self;

/**
 * Adds the routed element's `uiCanExit` to `trans` when it exits the view's
 * state.
 */
const invokeUiCanExit = (
  registration: ActiveUIView,
  target: ViewTarget,
  trans: Transition,
): void => {
  const instance: (Partial<UiOnExit> & Element) | null = target.routedElement;
  const uiCanExitFn = instance?.uiCanExit;

  if (
    isFunction(uiCanExitFn) &&
    trans.exiting().includes(viewState(registration))
  ) {
    trans.onStart({}, function () {
      return uiCanExitFn.call(instance, trans);
    });
  }
};

/** The params `$transition$` added or changed, among those its `to` path declares. */
const changedParams = ($transition$: Transition): RawParams | undefined => {
  const toParams: RawParams = $transition$.params('to');
  const fromParams: RawParams = $transition$.params('from');
  const getNodeSchema = (node: PathNode) => node.paramSchema;

  const toSchema: Param[] = $transition$
    .treeChanges('to')
    .map(getNodeSchema)
    .reduce<Param[]>(unnestR, []);

  const fromSchema: Param[] = $transition$
    .treeChanges('from')
    .map(getNodeSchema)
    .reduce<Param[]>(unnestR, []);

  const changedKeys: string[] = [];

  for (const param of toSchema) {
    const idx = fromSchema.indexOf(param);

    if (
      idx === -1 ||
      !fromSchema[idx].type.equals(toParams[param.id], fromParams[param.id])
    ) {
      changedKeys.push(param.id);
    }
  }

  if (!changedKeys.length) {
    return undefined;
  }

  // `$transition$.params()` still has every param.
  return filter(toParams, (_, key) => changedKeys.includes(key!));
};

/**
 * Re-renders the view after a successful transition, and hands the routed
 * element's `uiOnParamsChanged` the params that changed, unless the transition
 * created the view or exits its state.
 */
const invokeUiOnParamsChanged = (
  registration: ActiveUIView,
  target: ViewTarget,
  $transition$: Transition,
): void => {
  // Fresh resolves need a re-render; rendering reuses the element rather than rebuilding it.
  target.requestUpdate();

  const instance: (Partial<UiOnParamsChanged> & Element) | null =
    target.routedElement;

  if (!isFunction(instance?.uiOnParamsChanged)) {
    return;
  }

  const viewCreationTrans: unknown = new ResolveContext(
    registration.config.path,
  ).getResolvable('$transition$').data;

  if (
    $transition$ === viewCreationTrans ||
    $transition$.exiting().includes(viewState(registration))
  ) {
    return;
  }

  const newValues = changedParams($transition$);

  if (newValues) {
    instance.uiOnParamsChanged(newValues, $transition$);
  }
};

/**
 * Registers `registration` with `router`'s view service, with the transition
 * hooks that drive `target`'s routed element.
 *
 * @returns the deregistrations, to run on disconnect
 *
 * @internal
 */
export const registerView = (
  router: UIRouter,
  registration: ActiveUIView,
  target: ViewTarget,
): DeregisterFn[] => [
  // SAFETY: hook registration returns its deregistration function
  router.transitionService.onBefore({}, (trans) => {
    invokeUiCanExit(registration, target, trans);
  }) as DeregisterFn,
  // SAFETY: hook registration returns its deregistration function
  router.transitionService.onSuccess({}, (trans) => {
    invokeUiOnParamsChanged(registration, target, trans);
  }) as DeregisterFn,
  router.viewService.registerUIView(registration),
];

/**
 * The template a lit view config routes: a class bound to a fresh renderer,
 * so a changed config drops the old element, or the template function itself.
 *
 * @internal
 */
export const routedComponentOf = (config: ViewConfig): RoutedLitTemplate => {
  // SAFETY: `litViewsBuilder` normalizes every view declaration of a lit state
  const { component } = config.viewDecl as NormalizedLitViewDeclaration;

  if (isRoutedLitElement(component)) {
    return routedLitElementRenderer(component);
  }

  warnForeignClass(component);

  return component;
};
