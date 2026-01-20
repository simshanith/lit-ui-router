import {
  Transition,
  HookResult,
  _ViewDeclaration,
  StateDeclaration,
  UIRouter,
  RawParams,
} from '@uirouter/core';
import { TemplateResult, LitElement } from 'lit';

/**
 * Interface for components that respond to parameter changes.
 *
 * When a component implements this interface, UI-Router will call the
 * `uiOnParamsChanged` method whenever dynamic parameter values change
 * without destroying and recreating the component.
 *
 * @example
 * ```ts
 * class UserDetail extends LitElement implements UiOnParamsChanged {
 *   uiOnParamsChanged(newParams: RawParams, trans?: Transition) {
 *     console.log('Parameters changed:', newParams);
 *     // React to the new userId
 *     if (newParams.userId) {
 *       this.loadUser(newParams.userId);
 *     }
 *   }
 * }
 * ```
 *
 * @see [[TransitionOptions]]
 *
 * @category hooks
 */
export interface UiOnParamsChanged {
  /**
   * A UI-Router view has a Lit `Component` (see [[NormalizedLitViewDeclaration.component]]).
   * The `Component` may define component-level hooks which UI-Router will call at the appropriate times.
   * These callbacks are similar to Transition Hooks ([[IHookRegistry]]), but are only called if the view/component is currently active.
   *
   * The uiOnParamsChanged callback is called when parameter values change.
   *
   * This callback is used to respond dynamic parameter values changing.
   * It is called when a transition changed one or more dynamic parameter values,
   * and the routed component was not destroyed.
   *
   * It receives two parameters:
   *
   * - An object with (only) changed parameter values.
   *   The keys are the parameter names and the values are the new parameter values.
   * - The [[Transition]] which changed the parameter values.
   *
   */
  uiOnParamsChanged(newParams: RawParams, trans?: Transition): void;
}

/**
 * Interface for components that can prevent or confirm navigation away.
 *
 * When a component implements this interface, UI-Router will call the
 * `uiCanExit` method before navigating away from the component's state.
 * This can be used to prompt for confirmation or prevent navigation.
 *
 * @example
 * ```ts
 * class EditForm extends LitElement implements UiOnExit {
 *   hasUnsavedChanges = false;
 *
 *   uiCanExit(trans?: Transition): HookResult {
 *     if (this.hasUnsavedChanges) {
 *       return window.confirm('Discard unsaved changes?');
 *     }
 *     return true;
 *   }
 * }
 * ```
 *
 * @see [[HookResult]]
 * @see [[Transition]]
 *
 * @category hooks
 */
export interface UiOnExit {
  /**
   * A UI-Router view has a Lit `Component` (see [[NormalizedLitViewDeclaration.component]]).
   * The `Component` may define component-level hooks which UI-Router will call at the appropriate times.
   * These callbacks are similar to Transition Hooks ([[IHookRegistry]]), but are only called if the view/component is currently active.
   *
   * The uiCanExit callback is called when the routed component's state is about to be exited.
   *
   * The callback can be used to cancel or alter the new [[Transition]] that would otherwise exit the component's state.
   *
   * This callback is used to inform a view that it is about to be exited, due to a new [[Transition]].
   * The callback can ask for user confirmation, and cancel or alter the new Transition. The callback should
   * return a value, or a promise for a value. If a promise is returned, the new Transition waits until the
   * promise settles.
   *
   * Called when:
   * - The component is still active inside a `ui-view`
   * - A new Transition is about to run
   * - The new Transition will exit the view's state
   *
   * Called with:
   * - The [[Transition]] that is about to exit the component's state
   *
   * @returns a hook result which may cancel or alter the pending Transition (see [[HookResult]])
   */
  uiCanExit(newTransition?: Transition): HookResult;
}

/**
 * Default Resolves Types when not provided to Generic UIViewResolves
 * @see [[UIViewResolves]]
 * @category types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- backwards compatible default
export type DefaultResolvesType = Record<string, any>;

/**
 * Type alias for resolved values passed to routed components.
 *
 * @template T - The shape of the resolved values object
 *
 * @see [[UIViewInjectedProps]]
 * @see [[DefaultResolvesType]]
 * @see [[StateDeclaration.resolve]]
 *
 * @category types
 */
export type UIViewResolves<
  T extends DefaultResolvesType = DefaultResolvesType,
> = T;

/**
 * Props injected into routed components by the `<ui-view>` element.
 *
 * These props provide access to the current transition, resolved data,
 * and the router instance. Components can use these to access routing
 * state and navigate programmatically.
 *
 * @template T - The shape of the resolved values object
 *
 * @example Using in a template function
 * ```ts
 * const UserDetail: RoutedLitTemplate = (props) => {
 *   const { resolves, router } = props!;
 *   return html`
 *     <h1>User: ${resolves?.user?.name}</h1>
 *     <button @click=${() => router.stateService.go('users')}>
 *       Back to Users
 *     </button>
 *   `;
 * };
 * ```
 *
 * @example Using in a LitElement class
 * ```ts
 * class UserDetail extends LitElement {
 *   _uiViewProps?: UIViewInjectedProps<{ user: User }>;
 *
 *   render() {
 *     const user = this._uiViewProps?.resolves?.user;
 *     return html`<h1>${user?.name}</h1>`;
 *   }
 * }
 * ```
 *
 * @see [[UIRouter]]
 * @see [[Transition]]
 *
 * @category types
 */
export interface UIViewInjectedProps<
  T extends DefaultResolvesType = DefaultResolvesType,
> {
  /** The current transition (if one is in progress) */
  transition?: Transition;
  /** Resolved data from state declarations */
  resolves: UIViewResolves<T>;
  /** The UIRouter instance for programmatic navigation */
  router: UIRouter;
}

/**
 * A function that returns a Lit TemplateResult for rendering in a `<ui-view>`.
 *
 * This is the **simplest way** to define route components - no LitElement class needed.
 * The function optionally receives [[UIViewInjectedProps]] as its argument.
 *
 * @example Simple template (no props needed)
 * ```ts
 * const HomeView: RoutedLitTemplate = () => html`<h1>Welcome Home</h1>`;
 *
 * // Or use directly inline in a state declaration:
 * { name: 'home', url: '/', component: () => html`<h1>Home</h1>` }
 * ```
 *
 * @example With route parameters
 * ```ts
 * const UserView: RoutedLitTemplate = (props) => html`
 *   <h1>User: ${props?.transition?.params().id}</h1>
 * `;
 * ```
 *
 * @example With resolved data (typed)
 * ```ts
 * interface UserResolves { user: { name: string } }
 *
 * const UserDetail: RoutedLitTemplate<UserResolves> = (props) => html`
 *   <h1>${props?.resolves?.user?.name}</h1>
 * `;
 * ```
 *
 * @category types
 */
export type RoutedLitTemplate<
  T extends DefaultResolvesType = DefaultResolvesType,
> =
  | ((props?: UIViewInjectedProps<T>) => TemplateResult)
  | ((props: UIViewInjectedProps<T>) => TemplateResult);

/**
 * A template function that can be used as a view declaration.
 */
export interface LitViewDeclarationTemplate<
  T extends DefaultResolvesType = DefaultResolvesType,
> extends _ViewDeclaration {
  (props: UIViewInjectedProps<T>): TemplateResult;
  (props?: UIViewInjectedProps<T>): TemplateResult;
}

/**
 * A LitElement class constructor that can be used in state declarations.
 *
 * The class should extend LitElement and optionally accept {@link UIViewInjectedProps}
 * in its constructor. The `sticky` property can be set to `true` to reuse the
 * same component instance across state transitions.
 *
 * @example
 * ```ts
 * class UserList extends LitElement {
 *   _uiViewProps: UIViewInjectedProps;
 *
 *   constructor(props: UIViewInjectedProps) {
 *     super();
 *     this._uiViewProps = props;
 *   }
 *
 *   render() {
 *     return html`<h1>Users</h1>`;
 *   }
 * }
 *
 * router.stateRegistry.register({
 *   name: 'users',
 *   url: '/users',
 *   component: UserList
 * });
 * ```
 *
 * @category types
 */
export interface RoutedLitElement<
  T extends DefaultResolvesType = DefaultResolvesType,
> {
  /** Overloaded constructor that requires UIViewInjectedProps */
  new (props: UIViewInjectedProps<T>): LitElement & {
    _uiViewProps: UIViewInjectedProps<T>;
  };

  /** If true, the same component instance is reused across state transitions */
  sticky?: boolean;
}

/**
 * Union type for components that can be used in state declarations.
 *
 * A routed component can be either:
 * - A {@link RoutedLitTemplate} function that returns a TemplateResult
 * - A {@link RoutedLitElement} class that extends LitElement
 *
 * @category types
 */
export type RoutedLitComponent<
  T extends DefaultResolvesType = DefaultResolvesType,
> = RoutedLitTemplate<T> | RoutedLitElement<T>;

/**
 * A LitElement class used directly as a view declaration.
 */
export interface LitViewDeclarationElement<
  T extends DefaultResolvesType = DefaultResolvesType,
> extends RoutedLitElement<T>,
    _ViewDeclaration {}

/**
 * A view declaration object with an explicit component property.
 */
export interface LitViewDeclarationObject<
  T extends DefaultResolvesType = DefaultResolvesType,
> extends _ViewDeclaration {
  component: RoutedLitComponent<T>;
}

/**
 * Union type for all valid view declaration formats.
 *
 * A view can be declared as:
 * - An object with a `component` property ({@link LitViewDeclarationObject})
 * - A LitElement class directly ({@link LitViewDeclarationElement})
 * - A template function directly ({@link LitViewDeclarationTemplate})
 */
export type LitViewDeclaration<
  T extends DefaultResolvesType = DefaultResolvesType,
> =
  | LitViewDeclarationObject<T>
  | LitViewDeclarationElement<T>
  | LitViewDeclarationTemplate<T>;

/**
 * State declaration interface for Lit applications.
 *
 * Extends the core [[StateDeclaration]] with Lit-specific component support.
 * The `component` property accepts template functions, LitElement classes, or both.
 *
 * @example Simplest: inline template function
 * ```ts
 * { name: 'home', url: '/', component: () => html`<h1>Home</h1>` }
 * ```
 *
 * @example Template with route parameters
 * ```ts
 * {
 *   name: 'user',
 *   url: '/user/:id',
 *   component: (props) => html`<h1>User ${props?.transition?.params().id}</h1>`
 * }
 * ```
 *
 * @example Template with resolved data
 * ```ts
 * {
 *   name: 'users',
 *   url: '/users',
 *   component: (props) => html`
 *     <ul>${props?.resolves?.users?.map(u => html`<li>${u.name}</li>`)}</ul>
 *   `,
 *   resolve: [{ token: 'users', resolveFn: () => fetch('/api/users').then(r => r.json()) }]
 * }
 * ```
 *
 * @example LitElement class (for complex components)
 * ```ts
 * { name: 'dashboard', url: '/dashboard', component: DashboardElement }
 * ```
 *
 * @example Nested states
 * ```ts
 * const states: LitStateDeclaration[] = [
 *   { name: 'app', abstract: true, component: AppShell },
 *   { name: 'app.home', url: '/home', component: () => html`<h1>Home</h1>` },
 *   { name: 'app.users', url: '/users', component: UsersView }
 * ];
 * ```
 *
 * @see [[StateDeclaration]]
 * @see {@link RoutedLitTemplate}
 * @see {@link RoutedLitElement}
 *
 * @category types
 */
export interface LitStateDeclaration<
  T extends DefaultResolvesType = DefaultResolvesType,
> extends StateDeclaration {
  /** The Lit component to render for this state */
  component?: LitViewDeclaration<T>;
}

/**
 * The `litViewsBuilder` registered in [[UIRouterLit.constructor]] normalizes config to this internal interface.
 *
 * @category types
 */
export interface NormalizedLitViewDeclaration<
  T extends DefaultResolvesType = DefaultResolvesType,
> extends _ViewDeclaration {
  component: RoutedLitTemplate<T>;
}
