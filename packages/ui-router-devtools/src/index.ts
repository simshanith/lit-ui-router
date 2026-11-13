export { observe, type ObserveOptions } from '@repo/router-events';

export { record, type Recorder, type RecordOptions } from './recorder.ts';

export { observedEdges, type EdgeOutcome, type ObservedEdge } from './edges.ts';

export {
  SCHEMA_VERSION,
  type ConfigEvent,
  type CurrentEvent,
  type EventBase,
  type InvalidEvent,
  type KnownPhase,
  type LocationInfo,
  type Outcome,
  type ParamInfo,
  type ParamValue,
  type Params,
  type Phase,
  type PhaseEvent,
  type Redaction,
  type ResolveEvent,
  type ResultEvent,
  type RouterEvent,
  type Scalar,
  type SchemaVersion,
  type Session,
  type Source,
  type StateInfo,
  type StatesEvent,
  type TransitionEvent,
  type TransitionOptionsInfo,
} from './schema.ts';
