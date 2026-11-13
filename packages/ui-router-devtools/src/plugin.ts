import type { UIRouter, UIRouterPlugin } from '@uirouter/core';
import { redactionOf } from '@repo/router-events/redaction';

import './define.ts';
import type { Redaction } from './schema.ts';
import type { UIRouterDevtools } from './ui-router-devtools.ts';

export type { UIRouterDevtools };

export interface DevtoolsPluginOptions {
  /** Time resolves by wrapping their `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
  /** What Export scrubs by default: param keys without their values and messages kept, unless set here. */
  redaction?: Partial<Redaction>;
}

/** Appends a `<ui-router-devtools>` for the router to `document.body`; `dispose()` removes it. */
export class DevtoolsPlugin implements UIRouterPlugin {
  name = 'devtools';
  readonly #element: UIRouterDevtools;

  constructor(
    router: UIRouter,
    { timeResolves = false, redaction }: DevtoolsPluginOptions = {},
  ) {
    this.#element = document.createElement('ui-router-devtools');
    this.#element.timeResolves = timeResolves;
    this.#element.redaction = redactionOf(redaction);
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
