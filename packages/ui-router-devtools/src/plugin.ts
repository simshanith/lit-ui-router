import type { UIRouter, UIRouterPlugin } from '@uirouter/core';

import './define.ts';
import type { UIRouterDevtools } from './ui-router-devtools.ts';

export interface DevtoolsPluginOptions {
  /** Time resolves by wrapping their `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
}

/** Appends a `<ui-router-devtools>` for the router to `document.body`; `dispose()` removes it. */
export class DevtoolsPlugin implements UIRouterPlugin {
  name = 'devtools';
  readonly #element: UIRouterDevtools;

  constructor(
    router: UIRouter,
    { timeResolves = false }: DevtoolsPluginOptions = {},
  ) {
    this.#element = document.createElement('ui-router-devtools');
    this.#element.timeResolves = timeResolves;
    this.#element.router = router;
    document.body.append(this.#element);
  }

  get element(): UIRouterDevtools {
    return this.#element;
  }

  dispose(): void {
    this.#element.remove();
  }
}
