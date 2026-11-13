export const SCHEMA_VERSION = 1;

export type Value = string | number | boolean | null;

export type Params = Record<string, Value>;

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
  name: string;
  parent: string | null;
  url: string | null;
  params: ParamInfo[];
  resolves: string[];
  future: boolean;
  abstract: boolean;
  redirects: boolean;
  // The `redirectTo` target, present only when the declaration names it statically.
  redirectTo?: string;
  // Deep state redirect (`@uirouter/dsr`); `default` is its static fallback target.
  dsr?: { default: string | null };
  // Sticky state (`@uirouter/sticky-states`).
  sticky?: boolean;
}

export type Phase =
  | 'before'
  | 'start'
  | 'exit'
  | 'retain'
  | 'enter'
  | 'finish'
  | 'success'
  | 'error';

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

interface Base {
  v: typeof SCHEMA_VERSION;
  t: number;
}

export interface ConfigEvent extends Base {
  type: 'config';
  location: LocationInfo;
  strictMode: boolean;
  caseInsensitive: boolean;
  plugins: string[];
}

export interface StatesEvent extends Base {
  type: 'states';
  states: StateInfo[];
}

export interface TransitionEvent extends Base {
  type: 'transition';
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

export interface PhaseEvent extends Base {
  type: 'phase';
  id: number;
  phase: Phase;
  edge: 'start' | 'end';
  state: string | null;
}

export interface ResolveEvent extends Base {
  type: 'resolve';
  id: number;
  token: string;
  state: string;
  start: number;
  end: number;
  ok: boolean;
  cached: boolean;
  message?: string;
}

export interface ResultEvent extends Base {
  type: 'result';
  id: number;
  outcome: Outcome;
  reason: string | null;
  message?: string;
}

// A target that names no state; core creates no Transition for it, so it has no id.
export interface InvalidEvent extends Base {
  type: 'invalid';
  key: number;
  from: string;
  to: string;
  toParams: Params;
  reason: string;
}

export interface CurrentEvent extends Base {
  type: 'current';
  name: string;
  params: Params;
}

export type DevtoolsEvent =
  | ConfigEvent
  | StatesEvent
  | TransitionEvent
  | PhaseEvent
  | ResolveEvent
  | ResultEvent
  | InvalidEvent
  | CurrentEvent;

export interface Session {
  v: typeof SCHEMA_VERSION;
  routerId: string;
  // Epoch milliseconds at which every event's `t` is 0.
  startedAt: number;
  events: DevtoolsEvent[];
}

/** Replaces a param value before it is recorded; the result is stored as JSON. */
export type Redact = (
  key: string,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a param value, which the app types
  value: unknown,
  where: 'from' | 'to' | 'current' | 'invalid',
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- any value; the adapter serialises it
) => unknown;
