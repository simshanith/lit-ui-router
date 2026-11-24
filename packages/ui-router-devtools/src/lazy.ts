/**
 * `LazyDevtoolsPlugin`, for `router.plugin(LazyDevtoolsPlugin)` before `router.start()`: it records from registration
 * and loads `<ui-router-devtools>` only on `activate()`, which replays what was recorded and then follows the router.
 *
 * @module
 */
import type { UIRouter, UIRouterPlugin } from '@uirouter/core';
import { redactionOf } from '@repo/router-events/redaction';

import type { DevtoolsPluginOptions } from './plugin.ts';
import { record, type Recorder } from './recorder.ts';
import type { UIRouterDevtools } from './ui-router-devtools.ts';

export type { DevtoolsPluginOptions, UIRouterDevtools };

/** Options for {@link LazyDevtoolsPlugin}: {@link DevtoolsPluginOptions}, plus the panel's history. */
export interface LazyDevtoolsPluginOptions extends DevtoolsPluginOptions {
  /** How many transitions the panel keeps, 500 by default; the recorder keeps 40 events for each. */
  history?: number;
}

/**
 * Records the router from registration; `activate()` loads `<ui-router-devtools>`, hands it the recorder and appends
 * it to `document.body`. Only the recorder loads with the plugin: lit, d3 and the element load on `activate()`.
 *
 * @example
 * ```ts
 * import { UIRouter } from '@uirouter/core';
 * import { LazyDevtoolsPlugin } from 'ui-router-devtools/lazy';
 *
 * declare const router: UIRouter;
 *
 * // Before the router starts, so the first transition is recorded.
 * const devtools = router.plugin(LazyDevtoolsPlugin, { timeResolves: true });
 *
 * // Later, from a key binding or a button: the panel shows every transition since registration.
 * void devtools.activate();
 * ```
 */
export class LazyDevtoolsPlugin implements UIRouterPlugin {
  /** The plugin's name in the router's plugin registry. */
  name = 'devtools';
  /** The recorder the plugin started; the panel follows it, and reporters can share it. */
  readonly recorder: Recorder;
  readonly #router: UIRouter;
  readonly #options: LazyDevtoolsPluginOptions;
  #element: UIRouterDevtools | undefined;
  #activating: Promise<UIRouterDevtools> | undefined;
  #disposed = false;

  constructor(router: UIRouter, options: LazyDevtoolsPluginOptions = {}) {
    const { history = 500, timeResolves = false } = options;

    this.#router = router;
    this.#options = options;
    this.recorder = record(router, { limit: history * 40, timeResolves });
  }

  /** The `<ui-router-devtools>` that `activate()` appended, once it has. */
  get element(): UIRouterDevtools | undefined {
    return this.#element;
  }

  /** Loads and appends `<ui-router-devtools>` once, showing everything recorded since registration; later calls return the same element. */
  activate(): Promise<UIRouterDevtools> {
    this.#activating ??= import('./define.ts').then(() => this.#mount());

    return this.#activating;
  }

  #mount(): UIRouterDevtools {
    if (this.#disposed) throw new Error('The devtools plugin was disposed');

    const {
      history = 500,
      timeResolves = false,
      redaction,
      viewLocator,
    } = this.#options;

    const element = document.createElement('ui-router-devtools');

    element.history = history;
    element.timeResolves = timeResolves;
    element.redaction = redactionOf(redaction);
    element.viewLocator = viewLocator?.(this.#router);
    element.recorder = this.recorder;
    element.router = this.#router;
    document.body.append(element);
    this.#element = element;

    return element;
  }

  /** Stops the recorder and removes the element. */
  dispose(): void {
    this.#disposed = true;
    this.recorder.stop();
    this.#element?.remove();
  }
}
