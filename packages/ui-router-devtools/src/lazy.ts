/**
 * `LazyDevtoolsPlugin`, for `router.plugin(LazyDevtoolsPlugin)` before `router.start()`: it records from registration
 * and loads `<ui-router-devtools>` only on `mount(target)`, which replays what was recorded and then follows the router.
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
 * Records the router from registration; `mount(target)` loads `<ui-router-devtools>`, hands it the recorder and appends
 * it to `target`, and `unmount()` removes it while the recorder keeps running. Only the recorder loads with the plugin:
 * lit, d3 and the element load on the first `mount()`.
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
 * await devtools.mount(document.body);
 * ```
 */
export class LazyDevtoolsPlugin implements UIRouterPlugin {
  /** The plugin's name in the router's plugin registry, shared with `DevtoolsPlugin`. */
  name = 'devtools';
  /** The recorder the plugin started; the panel follows it, and reporters can share it. */
  readonly recorder: Recorder;
  readonly #router: UIRouter;
  readonly #options: LazyDevtoolsPluginOptions;
  #element: UIRouterDevtools | undefined;
  #state: 'unmounted' | 'mounting' | 'mounted' = 'unmounted';
  #mounting: AbortController | undefined;
  #disposed = false;

  constructor(router: UIRouter, options: LazyDevtoolsPluginOptions = {}) {
    const { history = 500, timeResolves = false } = options;

    this.#router = router;
    this.#options = options;
    this.recorder = record(router, { limit: history * 40, timeResolves });
  }

  /** The `<ui-router-devtools>` in the DOM while the plugin is mounted. */
  get element(): UIRouterDevtools | undefined {
    return this.#state === 'mounted' ? this.#element : undefined;
  }

  /**
   * Loads `<ui-router-devtools>`, hands it the recorder and appends it to `target`; the panel shows everything recorded
   * since registration. Resolves once the element is in the DOM, or without appending it when `unmount()` or `dispose()`
   * comes first. Rejects while the plugin is mounted or mounting, and once it is disposed.
   */
  async mount(target: Element): Promise<void> {
    if (this.#disposed) throw new Error('The devtools plugin was disposed');

    if (this.#state !== 'unmounted')
      throw new Error('The devtools panel is already mounted');

    this.#state = 'mounting';
    const mounting = (this.#mounting = new AbortController());

    try {
      await import('./define.ts');
    } finally {
      // A failed import leaves the plugin unmounted; a later mount() owns the state once this one is cancelled.
      if (this.#mounting === mounting) this.#state = 'unmounted';
    }

    if (mounting.signal.aborted) return;

    const element = (this.#element ??= this.#create());

    target.append(element);
    this.#state = 'mounted';
  }

  /** Removes the element and keeps the recorder running, so the next `mount()` replays it; cancels a `mount()` still loading. */
  unmount(): void {
    if (this.#state === 'unmounted')
      throw new Error('The devtools panel is not mounted');

    this.#mounting?.abort();
    this.#element?.remove();
    this.#state = 'unmounted';
  }

  #create(): UIRouterDevtools {
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

    return element;
  }

  /** Stops the recorder and unmounts the element. */
  dispose(): void {
    this.#disposed = true;
    this.recorder.stop();

    if (this.#state !== 'unmounted') this.unmount();
  }
}
