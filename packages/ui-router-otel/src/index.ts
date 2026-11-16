export { OtelPlugin, type OtelPluginOptions } from './plugin.ts';

export type { ReportOptions } from './reporter.ts';

export {
  DevtoolsSpanProcessor,
  type DevtoolsSpanProcessorOptions,
  type ProcessedSpan,
  type SpanSink,
} from './processor.ts';

export type {
  SpanAttributeValue,
  SpanRecord,
} from '@repo/router-events/schema';
