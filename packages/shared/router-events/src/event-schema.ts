/**
 * Bumped only by a breaking change. Added optional fields, new event types and new values of an open enum keep it,
 * so a reader ignores fields and event types it does not know and tolerates open-enum values it does not know.
 */
export const SCHEMA_VERSION = 1;

export type SchemaVersion = typeof SCHEMA_VERSION;

export type Scalar = string | number | boolean | null;

/** A recorded param value: arrays stay arrays, Dates become ISO strings, anything JSON cannot hold becomes a tag such as `[function]`. */
export type ParamValue = Scalar | Scalar[];

export type Params = Record<string, ParamValue>;

export interface ParamInfo {
  id: string;
  type: string;
  optional: boolean;
  dynamic: boolean;
  array: boolean;
  inherit: boolean;
  squash: boolean | string;
}

export interface StateInfo {
  /** As registered; a lazy (future) state keeps its `.**` suffix. */
  name: string;
  parent: string | null;
  /** The declared url fragment, relative to the parent's. */
  url: string | null;
  params: ParamInfo[];
  resolves: string[];
  future: boolean;
  abstract: boolean;
  redirects: boolean;
  redirectTo?: string;
  dsr?: { default: string | null };
  sticky?: boolean;
}

/** The phases the adapter emits. */
export type KnownPhase =
  | 'before'
  | 'start'
  | 'exit'
  | 'retain'
  | 'enter'
  | 'finish'
  | 'success'
  | 'error';

/** A known phase, or one a later v1 adds (a plugin's hook type, say), kept by its own name. */
export type Phase = KnownPhase | (string & {});

export type Outcome =
  | 'success'
  | 'error'
  | 'redirected'
  | 'superseded'
  | 'aborted'
  | 'ignored'
  | 'invalid';

export type Source = 'sref' | 'url' | 'redirect' | 'otherwise' | 'unknown';

export interface TransitionOptionsInfo {
  source: Source;
  location: boolean | 'replace';
  reload: boolean | string;
  inherit: boolean;
  supercede: boolean;
}

export interface LocationInfo {
  kind: 'hash' | 'pushState' | 'memory' | 'other';
  plugin: string | null;
  baseHref: string;
  hashPrefix: string;
  html5Mode: boolean;
}

export interface EventBase {
  v: SchemaVersion;
  /** Per observer, from 1, one per emitted event; a gap means events were dropped. */
  seq: number;
  /** Milliseconds since the realm's `performance.timeOrigin`. */
  t: number;
}

export interface ConfigEvent extends EventBase {
  type: 'config';
  location: LocationInfo;
  strictMode: boolean;
  caseInsensitive: boolean;
  plugins: string[];
}

export interface StatesEvent extends EventBase {
  type: 'states';
  states: StateInfo[];
}

/** The root state is `''` in `from`, `to` and `name`, and is never listed in a path. */
export interface TransitionEvent extends EventBase {
  type: 'transition';
  /** Core's `Transition.$id`: unique per router, from 0. */
  id: number;
  from: string;
  to: string;
  fromParams: Params;
  toParams: Params;
  entering: string[];
  exiting: string[];
  retained: string[];
  redirectedFrom: number | null;
  options: TransitionOptionsInfo;
  dynamic: boolean;
}

export interface PhaseEvent extends EventBase {
  type: 'phase';
  id: number;
  phase: Phase;
  edge: 'start' | 'end';
  /** The state a per-state phase (exit, retain, enter) runs for; null for a transition-wide phase. */
  state: string | null;
}

export interface ResolveEvent extends EventBase {
  type: 'resolve';
  id: number;
  token: string;
  state: string;
  start: number;
  end: number;
  ok: boolean;
  cached: boolean;
  /** Free text from the app; redactable. */
  message?: string;
  /** The thrown Error's `name`, when the resolve threw or rejected with one. */
  errorName?: string;
}

export interface ResultEvent extends EventBase {
  type: 'result';
  id: number;
  outcome: Outcome;
  /** The transition that took over: a redirect's successor, or the transition that superseded this one. */
  by?: number;
  /** Free text from the app or from core; redactable. Present on error and invalid, and on aborted when core gives a reason. */
  message?: string;
  /** The thrown Error's `name`, on an error outcome where a hook or resolve threw one. */
  errorName?: string;
  /** Ids of the params that failed validation, on an invalid outcome. */
  invalidParams?: string[];
}

/** A target that names no state; core creates no Transition for it. */
export interface InvalidEvent extends EventBase {
  type: 'invalid';
  from: string;
  to: string;
  toParams: Params;
}

export interface CurrentEvent extends EventBase {
  type: 'current';
  name: string;
  params: Params;
}

export type RouterEvent =
  | ConfigEvent
  | StatesEvent
  | TransitionEvent
  | PhaseEvent
  | ResolveEvent
  | ResultEvent
  | InvalidEvent
  | CurrentEvent;

export interface Redaction {
  /** Param keys whose values are kept; every other value becomes `[redacted]`. `'all'` keeps every value. */
  params: readonly string[] | 'all';
  /** Whether free-text `message` fields are kept. */
  messages: boolean;
}

/** A span attribute's value, as tracing libraries allow it: a scalar or an array of one kind of scalar. */
export type SpanAttributeValue =
  | string
  | number
  | boolean
  | (string | number | boolean | null)[];

/**
 * A span from a tracer, in a shape that names no tracing library. Times are epoch milliseconds, so a span's offset on
 * the event clock is `startTime - timeOrigin`.
 */
export interface SpanRecord {
  traceId: string;
  spanId: string;
  /** Absent on the root of a trace. */
  parentSpanId?: string;
  name: string;
  startTime: number;
  /** Absent while the span is still running. */
  endTime?: number;
  status?: 'unset' | 'ok' | 'error';
  attributes?: Record<string, SpanAttributeValue>;
}

export interface Session {
  format: 'ui-router-session';
  v: SchemaVersion;
  /** Minted when the recorder starts, with `crypto.randomUUID()`. */
  id: string;
  generator: { name: string; version: string };
  /** The recorder's label for its router, unique within one page. */
  routerId: string;
  /** Epoch milliseconds of the recording realm's `performance.timeOrigin`; an event's epoch time is `timeOrigin + t`. */
  timeOrigin: number;
  /** The event clock at export, so an imported running transition has an end. */
  t: number;
  /** Events the recorder discarded; 0 means the session is complete since recording began. */
  dropped: number;
  /** Whether the recorder timed resolves; without it a session has no resolve events. */
  timeResolves: boolean;
  /** What the export scrubbed. */
  redaction: Redaction;
  /** The latest config, states and current snapshots first, then the kept events in `seq` order. */
  events: RouterEvent[];
  /** Spans that ran during a recorded transition, when the panel was given any; absent otherwise. */
  spans?: SpanRecord[];
}
