import type { TemplateResult } from 'lit';
import {
  applyPairs,
  isString,
  ResolveContext,
  Transition,
  UIRouter,
} from '@uirouter/core';

import type { RoutedLitTemplate, UIViewInjectedProps } from './interface.js';

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
    .filter(isString)
    .filter((token) => {
      const resolvable = context.getResolvable(token);

      return (
        resolvable.resolved || context.getPolicy(resolvable).async === 'NOWAIT'
      );
    })
    .map((token): [string, unknown] => [token, injector.get<unknown>(token)])
    .reduce(applyPairs, {});

  const transition = injector.get<Transition>(Transition);

  return { router, resolves, transition };
};

/**
 * The template a routed view renders for its single entry: `component` called
 * with the props `<ui-view>` injects, built from `context`.
 *
 * `<ui-view>` renders through it, and `lit-ui-router-ssr` serves through it, so
 * the served markup and the client's first render come from one place.
 *
 * Plumbing shared with `lit-ui-router-ssr`, not a supported import: its
 * signature and output follow the served `<ui-view>` markup, which is internal
 * to the two packages.
 *
 * @param component - the view's template component
 * @param router - the router handed to the component
 * @param context - the resolve context over the view config's path
 * @returns the component's template
 *
 * @internal
 */
export const routedViewTemplate = (
  component: RoutedLitTemplate,
  router: UIRouter,
  context: ResolveContext,
): TemplateResult => component(routedViewProps(router, context));
