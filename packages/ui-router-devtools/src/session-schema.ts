// The session file's shape, for import and for the published JSON Schema; the panel loads it on first import.
import * as v from 'valibot';

import type { RouterEvent, Session } from './schema.ts';

// An enum a later v1 may extend: the known values are documented, and an unknown one reads as `fallback`.
const open = <const T extends string>(
  values: readonly [T, ...T[]],
  fallback: T,
) => {
  const known = v.picklist(values);

  return v.pipe(
    v.union([known, v.string()]),
    v.transform((value): T => (v.is(known, value) ? value : fallback)),
  );
};

const scalar = v.union([v.string(), v.number(), v.boolean(), v.null()]);

const params = v.record(v.string(), v.union([scalar, v.array(scalar)]));

const base = { v: v.literal(1), seq: v.number(), t: v.number() };

const strings = v.array(v.string());

const paramInfo = v.looseObject({
  id: v.string(),
  type: v.string(),
  optional: v.boolean(),
  dynamic: v.boolean(),
  array: v.boolean(),
  inherit: v.boolean(),
  squash: v.union([v.boolean(), v.string()]),
});

const stateInfo = v.looseObject({
  name: v.string(),
  parent: v.nullable(v.string()),
  url: v.nullable(v.string()),
  params: v.array(paramInfo),
  resolves: strings,
  future: v.boolean(),
  abstract: v.boolean(),
  redirects: v.boolean(),
  redirectTo: v.optional(v.string()),
  dsr: v.optional(v.looseObject({ default: v.nullable(v.string()) })),
  sticky: v.optional(v.boolean()),
});

const configEvent = v.looseObject({
  ...base,
  type: v.literal('config'),
  location: v.looseObject({
    kind: open(['hash', 'pushState', 'memory', 'other'], 'other'),
    plugin: v.nullable(v.string()),
    baseHref: v.string(),
    hashPrefix: v.string(),
    html5Mode: v.boolean(),
  }),
  strictMode: v.boolean(),
  caseInsensitive: v.boolean(),
  plugins: strings,
});

const statesEvent = v.looseObject({
  ...base,
  type: v.literal('states'),
  states: v.array(stateInfo),
});

const transitionEvent = v.looseObject({
  ...base,
  type: v.literal('transition'),
  id: v.number(),
  from: v.string(),
  to: v.string(),
  fromParams: params,
  toParams: params,
  entering: strings,
  exiting: strings,
  retained: strings,
  redirectedFrom: v.nullable(v.number()),
  options: v.looseObject({
    source: open(
      ['sref', 'url', 'redirect', 'otherwise', 'unknown'],
      'unknown',
    ),
    location: v.union([v.boolean(), v.literal('replace')]),
    reload: v.union([v.boolean(), v.string()]),
    inherit: v.boolean(),
    supercede: v.boolean(),
  }),
  dynamic: v.boolean(),
});

const phaseEvent = v.looseObject({
  ...base,
  type: v.literal('phase'),
  id: v.number(),
  // Open, with no fallback: an unknown phase keeps its name rather than read as a known one.
  phase: v.union([
    v.picklist([
      'before',
      'start',
      'exit',
      'retain',
      'enter',
      'finish',
      'success',
      'error',
    ]),
    v.string(),
  ]),
  // Closed: a reader pairs a phase's two edges, and could not pair a third kind.
  edge: v.picklist(['start', 'end']),
  state: v.nullable(v.string()),
});

const resolveEvent = v.looseObject({
  ...base,
  type: v.literal('resolve'),
  id: v.number(),
  token: v.string(),
  state: v.string(),
  start: v.number(),
  end: v.number(),
  ok: v.boolean(),
  cached: v.boolean(),
  message: v.optional(v.string()),
  errorName: v.optional(v.string()),
});

const resultEvent = v.looseObject({
  ...base,
  type: v.literal('result'),
  id: v.number(),
  outcome: open(
    [
      'success',
      'error',
      'redirected',
      'superseded',
      'aborted',
      'ignored',
      'invalid',
    ],
    'aborted',
  ),
  by: v.optional(v.number()),
  message: v.optional(v.string()),
  errorName: v.optional(v.string()),
  invalidParams: v.optional(strings),
});

const invalidEvent = v.looseObject({
  ...base,
  type: v.literal('invalid'),
  from: v.string(),
  to: v.string(),
  toParams: params,
});

const currentEvent = v.looseObject({
  ...base,
  type: v.literal('current'),
  name: v.string(),
  params,
});

const EVENTS = {
  config: configEvent,
  states: statesEvent,
  transition: transitionEvent,
  phase: phaseEvent,
  resolve: resolveEvent,
  result: resultEvent,
  invalid: invalidEvent,
  current: currentEvent,
};

const KNOWN = v.picklist([
  'config',
  'states',
  'transition',
  'phase',
  'resolve',
  'result',
  'invalid',
  'current',
]);

// A later v1 may add event types; a reader skips them.
const laterEvent = v.looseObject({
  ...base,
  type: v.pipe(v.string(), v.notValues(KNOWN.options)),
});

const envelope = {
  format: v.literal('ui-router-session'),
  v: v.literal(1),
  id: v.string(),
  generator: v.looseObject({ name: v.string(), version: v.string() }),
  routerId: v.string(),
  timeOrigin: v.number(),
  t: v.number(),
  dropped: v.number(),
  timeResolves: v.boolean(),
  redaction: v.looseObject({
    params: v.union([strings, v.literal('all')]),
    messages: v.boolean(),
  }),
};

const sessionFile = v.looseObject({
  ...envelope,
  events: v.array(v.union([...Object.values(EVENTS), laterEvent])),
});

const readable = v.looseObject({
  ...envelope,
  events: v.array(v.looseObject({ type: v.string() })),
});

/** The session file's schema, for the build that writes it out as JSON Schema. */
export const sessionSchema = (): v.GenericSchema => sessionFile;

/** The JSON Schema's definitions: one per event type, and the shape of a later one. */
export interface EventSchemas {
  readonly ConfigEvent: v.GenericSchema;
  readonly StatesEvent: v.GenericSchema;
  readonly TransitionEvent: v.GenericSchema;
  readonly PhaseEvent: v.GenericSchema;
  readonly ResolveEvent: v.GenericSchema;
  readonly ResultEvent: v.GenericSchema;
  readonly InvalidEvent: v.GenericSchema;
  readonly CurrentEvent: v.GenericSchema;
  readonly LaterEvent: v.GenericSchema;
}

export const eventSchemas = (): EventSchemas => ({
  ConfigEvent: configEvent,
  StatesEvent: statesEvent,
  TransitionEvent: transitionEvent,
  PhaseEvent: phaseEvent,
  ResolveEvent: resolveEvent,
  ResultEvent: resultEvent,
  InvalidEvent: invalidEvent,
  CurrentEvent: currentEvent,
  LaterEvent: laterEvent,
});

export type ReadResult =
  | { ok: true; session: Session; skipped: number }
  | { ok: false; error: string };

const issueText = (issues: readonly v.BaseIssue<unknown>[]): string => {
  const [issue] = issues;

  if (!issue) return 'the file does not match the session schema.';
  const path = v.getDotPath(issue);

  return `${path ?? 'the session'}: ${issue.message}`;
};

const readEvent = (event: { type: string }): RouterEvent | null => {
  if (!v.is(KNOWN, event.type)) return null;
  const read = v.safeParse(EVENTS[event.type], event);

  return read.success ? read.output : null;
};

/** Reads a parsed session file: unknown fields pass through, and events of an unknown type or that do not read are skipped and counted. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a parsed file, which this function exists to check
export const readSession = (json: unknown): ReadResult => {
  if (!v.is(v.looseObject({ format: v.literal('ui-router-session') }), json))
    return {
      ok: false,
      error:
        "not a ui-router session file; it has no format: 'ui-router-session'.",
    };

  if (!v.is(v.looseObject({ v: v.literal(1) }), json))
    return {
      ok: false,
      error: `this panel reads session schema v1, and the file is v${String(json.v)}.`,
    };

  const read = v.safeParse(readable, json);

  if (!read.success) return { ok: false, error: issueText(read.issues) };

  const events = read.output.events.flatMap((event) => {
    const known = readEvent(event);

    return known ? [known] : [];
  });

  return {
    ok: true,
    session: { ...read.output, events },
    skipped: read.output.events.length - events.length,
  };
};
