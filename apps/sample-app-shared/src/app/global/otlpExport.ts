import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';

export interface OtlpExportEnv {
  /** The OTLP/HTTP traces URL, `/v1/traces` included. */
  readonly VITE_OTLP_TRACES_ENDPOINT?: string;
  /** `name=value` pairs joined by commas, as in `OTEL_EXPORTER_OTLP_HEADERS`. */
  readonly VITE_OTLP_TRACES_HEADERS?: string;
  readonly VITE_OTLP_SERVICE_NAME?: string;
}

/** Parses a `name=value,name=value` list, each side percent-decoded, skipping entries with no name. */
export function parseOtlpHeaders(list = ''): Record<string, string> {
  return Object.fromEntries(
    list.split(',').flatMap((entry) => {
      const at = entry.indexOf('=');
      const name = entry.slice(0, at).trim();

      return at > 0 && name
        ? [
            [
              decodeURIComponent(name),
              decodeURIComponent(entry.slice(at + 1).trim()),
            ],
          ]
        : [];
    }),
  );
}

/**
 * A batching OTLP/HTTP span processor for `url`, and the resource that names the app. In a browser the batch
 * processor flushes when the page is hidden, and the exporter sends with `keepalive`, so an unload keeps its spans.
 */
export function otlpExport(url: string, env: OtlpExportEnv) {
  return {
    resource: defaultResource().merge(
      resourceFromAttributes({
        'service.name': env.VITE_OTLP_SERVICE_NAME || 'sample-app',
      }),
    ),
    processor: new BatchSpanProcessor({
      exporter: new OTLPTraceExporter({
        url,
        headers: parseOtlpHeaders(env.VITE_OTLP_TRACES_HEADERS),
      }),
    }),
  };
}
