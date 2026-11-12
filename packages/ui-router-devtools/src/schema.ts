import type {
  SCHEMA_VERSION,
  RouterEvent as DevtoolsEvent,
} from '@repo/router-events/schema';

export {
  SCHEMA_VERSION,
  type ConfigEvent,
  type CurrentEvent,
  type InvalidEvent,
  type LocationInfo,
  type Outcome,
  type ParamInfo,
  type Params,
  type Phase,
  type PhaseEvent,
  type Redact,
  type ResolveEvent,
  type ResultEvent,
  type RouterEvent as DevtoolsEvent,
  type Source,
  type StateInfo,
  type StatesEvent,
  type TransitionEvent,
  type TransitionOptionsInfo,
  type Value,
} from '@repo/router-events/schema';

export interface Session {
  v: typeof SCHEMA_VERSION;
  routerId: string;
  // Epoch milliseconds at which every event's `t` is 0.
  startedAt: number;
  events: DevtoolsEvent[];
}
