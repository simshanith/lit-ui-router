import type { TemplateResult } from 'lit';
import { isString, ResolveContext, Transition, UIRouter } from '@uirouter/core';

import type {
  RoutedLitComponent,
  UIViewInjectedProps,
  UIViewResolves,
} from './interface.js';
import {
  isRoutedLitElement,
  renderRoutedView,
  routedLitElementRenderer,
} from './routed-element.js';

/**
 * The props `<ui-view>` hands a routed component: the router, the transition,
 * and every resolve that has resolved or is `NOWAIT`.
 */
const routedViewProps = (
  router: UIRouter,
  context: ResolveContext,
): UIViewInjectedProps => {
  const injector = context.injector();

  // The injector hands a NOWAIT token's promise, which renders before it settles.
  const resolves = context
    .getTokens()
    .reduce<UIViewResolves>((pairs, token) => {
      if (!isString(token)) {
        return pairs;
      }

      const resolvable = context.getResolvable(token);

      if (
        resolvable.resolved ||
        context.getPolicy(resolvable).async === 'NOWAIT'
      ) {
        pairs[token] = injector.get<unknown>(token);
      }

      return pairs;
    }, {});

  const transition = injector.get<Transition>(Transition);

  return { router, resolves, transition };
};

/**
 * The template a routed view renders for its single entry, from the props
 * `<ui-view>` injects, built from `context`.
 *
 * A template component is called with the props. A class component renders
 * its element in the first of `<ui-view>`'s two element slots,
 * `` html`${element}${nothing}` ``, and `routedElementOf` reads the
 * element back from the result. Pass a class itself for a one-off render, or
 * the renderer `<ui-view>` or a `sticky` declaration bound it to, so the
 * element outlives the call. `adopted` is the element a server rendered for
 * the view: a bound class takes it, on its first call, instead of
 * constructing one.
 *
 * `<ui-view>` renders through it, and `lit-ui-router-ssr` serves through it, so
 * the served markup and the client's first render come from one place.
 *
 * Plumbing shared with `lit-ui-router-ssr`, not a supported import: its
 * signature and output follow the served `<ui-view>` markup, which is internal
 * to the two packages.
 *
 * @param component - the view's component, or the renderer bound to its class
 * @param router - the router handed to the component
 * @param context - the resolve context over the view config's path
 * @param adopted - the element a server rendered for the view, if any
 * @returns the component's template
 *
 * @internal
 */
export const routedViewTemplate = (
  component: RoutedLitComponent,
  router: UIRouter,
  context: ResolveContext,
  adopted?: Element,
): TemplateResult =>
  renderRoutedView(
    isRoutedLitElement(component)
      ? routedLitElementRenderer(component)
      : component,
    routedViewProps(router, context),
    adopted,
  );
