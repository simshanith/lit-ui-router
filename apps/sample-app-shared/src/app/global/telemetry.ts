import { context, trace } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import type { UIRouter } from '@uirouter/core';
import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type SpanSink,
} from 'ui-router-otel';

/**
 * Sends the router's spans and the app's own to the devtools Timeline, and nowhere else: the provider's only
 * processor is the panel's. The stack context manager parents a span started in a resolve's synchronous part.
 * `router.dispose()` removes the plugin and the global provider.
 */
export function installTelemetry(
  router: UIRouter,
  sink: () => SpanSink | null | undefined,
): void {
  const provider = new TracerProvider({
    spanProcessors: [new DevtoolsSpanProcessor(sink)],
  });

  context.setGlobalContextManager(new StackContextManager().enable());
  trace.setGlobalTracerProvider(provider);

  router.plugin(OtelPlugin, {
    tracer: provider.getTracer('sample-app-shared'),
    activateResolveSpans: true,
  });

  router.disposable({
    dispose() {
      trace.disable();
      context.disable();
      void provider.shutdown();
    },
  });
}
