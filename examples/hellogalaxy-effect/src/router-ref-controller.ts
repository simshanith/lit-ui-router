// Part of the same `ui-router-effect` spike as effect-plugin.ts: the
// ReactiveController half, shaped after lit-ui-router-mobx's
// RouterReactionController.
import { Effect, Fiber, Stream, SubscriptionRef } from 'effect';
import { UIRouter } from '@uirouter/core';
import { ReactiveController, ReactiveControllerHost } from 'lit';
import { UIRouterLitElement } from 'lit-ui-router';

import { EffectPlugin, RouteSnapshot } from './effect-plugin.js';

export interface RouterRefControllerOptions<Value, Selected> {
  /** Explicit router; otherwise discovered from the enclosing `<ui-router>`. */
  router?: UIRouter;
  equals?: (a: Selected, b: Selected) => boolean;
  /** Which plugin ref to follow. Defaults to the route snapshot. */
  ref?: (plugin: EffectPlugin) => SubscriptionRef.SubscriptionRef<Value>;
}

/**
 * Follows one `SubscriptionRef` on the `effect` plugin and re-renders the host
 * when the selected value changes.
 *
 * `Stream.runForEach(ref.changes, ...)` is forked on the plugin's runtime at
 * `hostConnected` and interrupted at `hostDisconnected`, so the subscription
 * lives exactly as long as the element is in the document.
 */
export class RouterRefController<
  Selected,
  Value = RouteSnapshot,
> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value!: Selected;

  private fiber?: Fiber.RuntimeFiber<void>;
  private initialized = false;
  private plugin?: EffectPlugin;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    private readonly selector: (value: Value) => Selected,
    private readonly options: RouterRefControllerOptions<Value, Selected> = {},
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    const router =
      this.options.router ?? UIRouterLitElement.seekRouter(this.host);
    const plugin = router?.getPlugin('effect') as EffectPlugin | undefined;
    if (!plugin) {
      console.warn(
        'RouterRefController: no <ui-router> with an effect plugin for host',
        this.host,
      );
      return;
    }
    this.plugin = plugin;
    const ref = this.options.ref
      ? this.options.ref(plugin)
      : (plugin.route as unknown as SubscriptionRef.SubscriptionRef<Value>);
    const equals = this.options.equals ?? Object.is;
    // `changes` replays the current value, so a reconnected host resynchronizes.
    this.fiber = plugin.runtime.runFork(
      Stream.runForEach(ref.changes, (next) =>
        Effect.sync(() => {
          const selected = this.selector(next);
          if (this.initialized && equals(selected, this.value)) return;
          this.initialized = true;
          this.value = selected;
          this.host.requestUpdate();
        }),
      ),
    );
  }

  hostDisconnected(): void {
    if (this.fiber && this.plugin) {
      this.plugin.runtime.runFork(Fiber.interrupt(this.fiber));
    }
    this.fiber = undefined;
  }
}
