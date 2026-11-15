import type { Tracer } from '@opentelemetry/api';
import type { UIRouter, UIRouterPlugin } from '@uirouter/core';
import { observe } from '@repo/router-events';

import { reportToTracer, type ReportOptions } from './reporter.ts';
import { activateHookSpans } from './hook-context.ts';
import { activateLazyLoadSpans } from './lazy-load-context.ts';
import { activateResolveSpans } from './resolve-context.ts';

export interface OtelPluginOptions extends ReportOptions {
  /** The tracer every span starts on; the app owns the provider, processors and exporter. */
  tracer: Tracer;
  /** Time resolves as child spans by wrapping their `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
  /**
   * Run each resolve's function with its resolve span active, so a span the app starts in it is that span's child.
   * It spans resolves itself, so `timeResolves` is not needed with it. Off by default: it patches core objects too,
   * and past an `await` the span stays active only under a context manager that follows async work.
   */
  activateResolveSpans?: boolean;
  /**
   * Run each app transition hook, a state's own `onEnter`, `onExit` and `onRetain` included, with its phase's span
   * active, so a span the app starts in it is that phase span's child. Core's own hooks are left as they are. Off by
   * default: it wraps core's registered hooks, and a transition whose `onBefore` hook ran is reported even when core
   * then ignores it.
   */
  activateHookSpans?: boolean;
  /**
   * Run each state's `lazyLoad` with a `lazy load <state>` span active, a child of the transition's span, so a span the
   * app starts in it is that span's child. Off by default: it patches core's state objects.
   */
  activateLazyLoadSpans?: boolean;
}

/** Reports the router's transitions as OpenTelemetry spans; `dispose()` ends the open ones and stops. */
export class OtelPlugin implements UIRouterPlugin {
  name = 'otel';
  readonly #dispose: () => void;

  constructor(
    router: UIRouter,
    {
      tracer,
      timeResolves = false,
      activateResolveSpans: active = false,
      activateHookSpans: hooks = false,
      activateLazyLoadSpans: lazyLoads = false,
      ...options
    }: OtelPluginOptions,
  ) {
    const reporter = reportToTracer(tracer, options);

    // Active resolve spans are started live, so the timed resolve events would span each resolve twice.
    const stop = observe(router, reporter.report, {
      timeResolves: timeResolves && !active,
    });

    const deactivate = [
      active && activateResolveSpans(router, reporter),
      hooks && activateHookSpans(router, reporter),
      lazyLoads && activateLazyLoadSpans(router, reporter),
    ];

    this.#dispose = () => {
      for (const off of deactivate) if (off) off();
      stop();
      reporter.dispose();
    };
  }

  dispose(): void {
    this.#dispose();
  }
}
