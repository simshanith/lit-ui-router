import { trace, type Tracer } from '@opentelemetry/api';
import { UIRouter } from '@uirouter/core';
import {
  DevtoolsSpanProcessor,
  OtelPlugin,
  type OtelPluginOptions,
  type ProcessedSpan,
  type SpanRecord,
  type SpanSink,
} from 'ui-router-otel';

const router = new UIRouter();

const tracer: Tracer = trace.getTracer('fixture');

const options: OtelPluginOptions = {
  tracer,
  redaction: { params: ['id'], messages: false },
  timeResolves: true,
  activateHookSpans: true,
  activateLazyLoadSpans: true,
  includeIgnored: false,
};

const plugin: OtelPlugin = router.plugin(OtelPlugin, options);

export const dispose: () => void = () => plugin.dispose();

const sink: SpanSink = { addSpan: (_span: SpanRecord) => {} };

const processor = new DevtoolsSpanProcessor(() => sink, { started: false });

export const onEnd: (span: ProcessedSpan) => void = (span) =>
  processor.onEnd(span);

export const shutdown: Promise<void> = processor.shutdown();
