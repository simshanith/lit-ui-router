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

/** An OTLP/HTTP export target a harness sets on the page before the app boots; it wins over the build's. */
export interface OtlpTracesOverride {
  /** The OTLP/HTTP traces URL, `/v1/traces` included. */
  endpoint: string;
  /** `name=value` pairs joined by commas, as in `OTEL_EXPORTER_OTLP_HEADERS`. */
  headers?: string;
}

declare global {
  var __OTLP_TRACES__: OtlpTracesOverride | undefined;
}

// Named reads, so the bundle carries these three values and not the whole env object.
const buildEnv: OtlpExportEnv = {
  VITE_OTLP_TRACES_ENDPOINT: import.meta.env.VITE_OTLP_TRACES_ENDPOINT,
  VITE_OTLP_TRACES_HEADERS: import.meta.env.VITE_OTLP_TRACES_HEADERS,
  VITE_OTLP_SERVICE_NAME: import.meta.env.VITE_OTLP_SERVICE_NAME,
};

/** The export settings: an override's endpoint and headers when one is set, else the build's. */
export function resolveOtlpExportEnv(
  override: OtlpTracesOverride | undefined,
  build: OtlpExportEnv,
): OtlpExportEnv {
  if (override === undefined) return build;

  if (!override.endpoint) {
    throw new TypeError('__OTLP_TRACES__.endpoint must be a non-empty string');
  }

  return {
    ...build,
    VITE_OTLP_TRACES_ENDPOINT: override.endpoint,
    VITE_OTLP_TRACES_HEADERS: override.headers,
  };
}

/**
 * Sends the router's spans and the app's own to the devtools Timeline, and, when `globalThis.__OTLP_TRACES__` or
 * the build's `VITE_OTLP_TRACES_ENDPOINT` names an endpoint, to that OTLP/HTTP receiver too. Without an endpoint
 * the exporter chunk is never loaded and the install completes before the returned promise does. The stack
 * context manager parents a span started in a resolve's synchronous part. `router.dispose()` removes the plugin
 * and the global provider.
 */
export async function installTelemetry(
  router: UIRouter,
  sink: () => SpanSink | null | undefined,
  env: OtlpExportEnv = resolveOtlpExportEnv(
    globalThis.__OTLP_TRACES__,
    buildEnv,
  ),
  loadOtlpExport: LoadOtlpExport = () => import('./otlpExport.js'),
): Promise<void> {
  const url = env.VITE_OTLP_TRACES_ENDPOINT;

  let otlp:
    | ReturnType<Awaited<ReturnType<LoadOtlpExport>>['otlpExport']>
    | undefined;

  // A chunk that fails to load, or an endpoint the exporter rejects, costs the export and never the Timeline's spans.
  try {
    if (url) otlp = (await loadOtlpExport()).otlpExport(url, env);
  } catch (error) {
    console.warn('OTLP span export is off:', error);
  }

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
