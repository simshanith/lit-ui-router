import { context, trace } from '@opentelemetry/api';
import { StackContextManager, TracerProvider } from '@opentelemetry/sdk-trace';
import type { UIRouter } from '@uirouter/core';
import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type SpanSink,
} from 'ui-router-otel';

import type { OtlpExportEnv } from './otlpExport.js';

type LoadOtlpExport = () => Promise<typeof import('./otlpExport.js')>;

// Named reads, so the bundle carries these three values and not the whole env object.
const buildEnv: OtlpExportEnv = {
  VITE_OTLP_TRACES_ENDPOINT: import.meta.env.VITE_OTLP_TRACES_ENDPOINT,
  VITE_OTLP_TRACES_HEADERS: import.meta.env.VITE_OTLP_TRACES_HEADERS,
  VITE_OTLP_SERVICE_NAME: import.meta.env.VITE_OTLP_SERVICE_NAME,
};

/**
 * Sends the router's spans and the app's own to the devtools Timeline, and, when the build sets
 * `VITE_OTLP_TRACES_ENDPOINT`, to that OTLP/HTTP receiver too. Without an endpoint the exporter chunk is never
 * loaded and the install completes before the returned promise does. The stack context manager parents a span
 * started in a resolve's synchronous part. `router.dispose()` removes the plugin and the global provider.
 */
export async function installTelemetry(
  router: UIRouter,
  sink: () => SpanSink | null | undefined,
  env: OtlpExportEnv = buildEnv,
  loadOtlpExport: LoadOtlpExport = () => import('./otlpExport.js'),
): Promise<void> {
  const url = env.VITE_OTLP_TRACES_ENDPOINT;
  const otlp = url ? (await loadOtlpExport()).otlpExport(url, env) : undefined;

  const provider = new TracerProvider({
    ...(otlp && { resource: otlp.resource }),
    spanProcessors: [
      new DevtoolsSpanProcessor(sink),
      ...(otlp ? [otlp.processor] : []),
    ],
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
