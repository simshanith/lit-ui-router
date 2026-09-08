import { html } from 'lit';

import type {
  DefaultResolvesType,
  RoutedLitElement,
  RoutedLitTemplate,
  UIViewInjectedProps,
} from './interface.js';

/**
 * Binds a routed class to a single instance for as long as the returned renderer
 * lives, so whoever holds the renderer decides how long the element survives.
 *
 * Not re-exported by `pure.ts`: this is plumbing shared by `core` and `ui-view`.
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
    return html`${element}`;
  };
}
