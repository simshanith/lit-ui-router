import type { Tracer } from '@opentelemetry/api';
import type { UIRouter, UIRouterPlugin } from '@uirouter/core';
import { observe } from '@repo/router-events';

import { reportToTracer, type ReportOptions } from './reporter.ts';

export interface OtelPluginOptions extends ReportOptions {
  /** The tracer every span starts on; the app owns the provider, processors and exporter. */
  tracer: Tracer;
  /** Time resolves as child spans by wrapping their `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
}

/** Reports the router's transitions as OpenTelemetry spans; `dispose()` ends the open ones and stops. */
export class OtelPlugin implements UIRouterPlugin {
  name = 'otel';
  readonly #dispose: () => void;

  constructor(
    router: UIRouter,
    { tracer, timeResolves = false, ...options }: OtelPluginOptions,
  ) {
    const reporter = reportToTracer(tracer, options);
    const stop = observe(router, reporter.report, { timeResolves });

    this.#dispose = () => {
      stop();
      reporter.dispose();
    };
  }

  dispose(): void {
    this.#dispose();
  }
}
