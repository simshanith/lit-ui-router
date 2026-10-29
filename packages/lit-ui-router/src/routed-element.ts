import { html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';

import type {
  DefaultResolvesType,
  RoutedLitElement,
  RoutedLitTemplate,
  UIViewInjectedProps,
} from './interface.js';

/** The element each renderer result carries, for `<ui-view>` to place itself. */
const carried = new WeakMap<TemplateResult, Element>();

/** Each renderer {@link routedLitElementRenderer} built, keyed by itself as its view holds it, taking an element to adopt. */
const adopting = new WeakMap<RoutedLitTemplate, RoutedViewRenderer>();

/**
 * A routed view's renderer: a template component, or a class bound by
 * {@link routedLitElementRenderer}, which also takes the element a server
 * rendered for it to adopt.
 *
 * @internal
 */
export type RoutedViewRenderer = (
  props: UIViewInjectedProps,
  adopted?: Element,
) => TemplateResult;

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
  const adopt = adopting.get(renderer);

  return adopt ? adopt(props, adopted) : renderer(props);
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
>(Component: RoutedLitElement<T>): RoutedLitTemplate<T> {
  let element: InstanceType<RoutedLitElement<T>> | undefined;

  const renderer = (props: UIViewInjectedProps<T>, adopted?: Element) => {
    element ??= adopted instanceof Component ? adopted : new Component(props);
    element._uiViewProps = props;
    const result = html`${element}${nothing}`;
    carried.set(result, element);

    return result;
  };

  // SAFETY: the renderer reads only the props its class was declared with, which a view's resolves supply
  adopting.set(renderer as RoutedLitTemplate, renderer as RoutedViewRenderer);

  return renderer;
}
