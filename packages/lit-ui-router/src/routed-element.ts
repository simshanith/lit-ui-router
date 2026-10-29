import { html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type {
  DefaultResolvesType,
  RoutedLitComponent,
  RoutedLitElement,
  RoutedLitTemplate,
  UIViewInjectedProps,
} from './interface.js';

/** The element each class result carries, recorded by the copy of this module that rendered it. */
const carried = new WeakMap<TemplateResult, Element>();

/**
 * Brands a renderer {@link routedLitElementRenderer} bound with its class.
 *
 * A `Symbol.for` key, not a module-local map: a renderer bound by one copy of
 * `lit-ui-router` is read by whichever copy `lit-ui-router-ssr` resolves.
 *
 * @internal
 */
export const routedClass: unique symbol = Symbol.for(
  'lit-ui-router#routed-class',
);

/**
 * A routed class bound to a single instance: a template function that also
 * takes the element a server rendered for it to adopt, branded with its class.
 *
 * @typeParam T - the resolves the routed element receives
 *
 * @internal
 */
export interface RoutedClassRenderer<
  T extends DefaultResolvesType = DefaultResolvesType,
> {
  (props: UIViewInjectedProps<T>, adopted?: Element): TemplateResult;
  /** The class this renderer builds its element from. */
  readonly [routedClass]: RoutedLitElement<T>;
}

/**
 * Whether `component` is a renderer bound to a routed class, by this copy of
 * `lit-ui-router` or another.
 *
 * @typeParam T - the resolves the routed element receives
 * @param component - a normalized view declaration's `component`
 * @returns whether `component` carries the {@link routedClass} brand
 *
 * @internal
 */
export const isRoutedClassRenderer = <
  T extends DefaultResolvesType = DefaultResolvesType,
>(
  component: RoutedLitComponent<T>,
): component is RoutedClassRenderer<T> =>
  typeof component === 'function' && routedClass in component;

/**
 * Calls `renderer`, offering `adopted` only to a bound class: a template
 * component never receives a second argument.
 *
 * @internal
 */
export const renderRoutedView = (
  renderer: RoutedLitTemplate,
  props: UIViewInjectedProps,
  adopted?: Element,
): TemplateResult => {
  if (!isRoutedClassRenderer(renderer)) {
    return renderer(props);
  }

  const result = renderer(props, adopted);
  // SAFETY: a bound class renders its element as the template's first value
  carried.set(result, result.values[0] as Element);

  return result;
};

/**
 * The routed element a class view's template carries, or `undefined` for a
 * template component's.
 *
 * A server renderer reads it to serialise the element, which `@lit-labs/ssr`
 * would otherwise write as text, and to recognise a `sticky` class, whose
 * declaration holds a bound renderer rather than the class.
 *
 * Plumbing shared with `lit-ui-router-ssr`, not a supported import.
 *
 * @param result - a template `routedViewTemplate` returned
 * @returns the element `result` places
 *
 * @internal
 */
export const routedElementOf = (result: TemplateResult): Element | undefined =>
  carried.get(result);

/**
 * Whether a view's `component` is a {@link RoutedLitElement} class rather than
 * a template function: a constructor whose prototype extends `LitElement`.
 *
 * A renderer that draws lit views outside `<ui-view>` uses it to choose
 * between instantiating the class and calling the template.
 *
 * @typeParam T - the resolves the routed element receives
 * @param component - a view declaration's `component`, or any other value
 * @returns whether `component` is a `LitElement` subclass
 *
 * @category core
 */
export function isRoutedLitElement<
  T extends DefaultResolvesType = DefaultResolvesType,
>(component?: unknown): component is RoutedLitElement<T> {
  return (
    (typeof component === 'object' || typeof component === 'function') &&
    component !== null &&
    'prototype' in component &&
    component.prototype instanceof LitElement
  );
}

/**
 * Binds a routed class to a single instance for as long as the returned renderer
 * lives, so whoever holds the renderer decides how long the element survives.
 *
 * The first call takes `adopted` when it is an instance of the class, the
 * element a server rendered, instead of constructing one. Every call assigns
 * the props, so an adopted element has them before its first update.
 *
 * The template is `<ui-view>`'s first class placement, the element in the
 * first of its two slots, so a served view hydrates against it.
 *
 * Not re-exported by `pure.ts`: this is plumbing shared by the view builder and `ui-view`.
 *
 * @internal
 */
export function routedLitElementRenderer<
  T extends DefaultResolvesType = DefaultResolvesType,
>(Component: RoutedLitElement<T>): RoutedClassRenderer<T> {
  let element: InstanceType<RoutedLitElement<T>> | undefined;

  return Object.assign(
    (props: UIViewInjectedProps<T>, adopted?: Element) => {
      element ??= adopted instanceof Component ? adopted : new Component(props);
      element._uiViewProps = props;

      return html`${element}${nothing}`;
    },
    { [routedClass]: Component },
  );
}
