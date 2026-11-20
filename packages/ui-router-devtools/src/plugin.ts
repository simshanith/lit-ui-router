/**
 * `DevtoolsPlugin`, for `router.plugin(DevtoolsPlugin)`: it registers `<ui-router-devtools>` and appends one for the
 * router to `document.body`.
 *
 * @module
 */
import type { UIRouter, UIRouterPlugin } from '@uirouter/core';
import { redactionOf } from '@repo/router-events/redaction';

import './define.ts';
import type { Redaction } from './schema.ts';
import type { UIRouterDevtools } from './ui-router-devtools.ts';
import type { ViewLocator } from './views.ts';

export type { UIRouterDevtools };

/** Options for {@link DevtoolsPlugin}, the second argument to `router.plugin(DevtoolsPlugin, options)`. */
export interface DevtoolsPluginOptions {
  /** Time resolves by wrapping their `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
  /** What Export scrubs by default: param keys without their values and messages kept, unless set here. */
  redaction?: Partial<Redaction>;
  /** Makes the element's `viewLocator` for the router, such as `litViewLocator` from `ui-router-devtools/lit-ui-router`. */
  viewLocator?: (router: UIRouter) => ViewLocator;
}

/** Appends a `<ui-router-devtools>` for the router to `document.body`; `dispose()` removes it. */
export class DevtoolsPlugin implements UIRouterPlugin {
  /** The plugin's name in the router's plugin registry. */
  name = 'devtools';
  readonly #element: UIRouterDevtools;

  constructor(
    router: UIRouter,
    {
      timeResolves = false,
      redaction,
      viewLocator,
    }: DevtoolsPluginOptions = {},
  ) {
    this.#element = document.createElement('ui-router-devtools');
    this.#element.timeResolves = timeResolves;
    this.#element.redaction = redactionOf(redaction);
    this.#element.viewLocator = viewLocator?.(router);
    this.#element.router = router;
    document.body.append(this.#element);
  }

  /** The `<ui-router-devtools>` the plugin appended. */
  get element(): UIRouterDevtools {
    return this.#element;
  }

  dispose(): void {
    this.#element.remove();
  }
}
