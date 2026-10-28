import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';

import type {
  DefaultResolvesType,
  RoutedLitElement,
  RoutedLitTemplate,
  UIViewInjectedProps,
} from './interface.js';

/** The element each renderer result carries, for `<ui-view>` to place itself. */
const carried = new WeakMap<TemplateResult, Element>();

/**
 * The routed element a {@link routedLitElementRenderer} result carries, if
 * `result` is one.
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
 * Not re-exported by `pure.ts`: this is plumbing shared by the view builder and `ui-view`.
 *
 * @internal
 */
export function routedLitElementRenderer<
  T extends DefaultResolvesType = DefaultResolvesType,
>(Component: RoutedLitElement<T>): RoutedLitTemplate<T> {
  let element: InstanceType<RoutedLitElement<T>>;

  return (props: UIViewInjectedProps<T>) => {
    element ??= new Component(props);
    element._uiViewProps = props;
    const result = html`${element}`;
    carried.set(result, element);

    return result;
  };
}
