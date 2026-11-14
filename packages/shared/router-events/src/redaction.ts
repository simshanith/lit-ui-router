import type {
  Params,
  Redaction,
  RouterEvent,
  Session,
} from './event-schema.ts';

/** What a redacted param value becomes. */
export const REDACTED = '[redacted]';

/** Keeps every param value and message. */
export const keepAll = (): Redaction => ({ params: 'all', messages: true });

/** The default for anything that leaves the page: param keys kept with their values redacted, messages kept. */
export const defaultRedaction = (): Redaction => ({
  params: [],
  messages: true,
});

/** Fills the parts of a redaction the caller left out from the default. */
export const redactionOf = (partial: Partial<Redaction> = {}): Redaction => ({
  ...defaultRedaction(),
  ...partial,
});

/** Keeps the values of the listed keys; every other non-null value becomes `[redacted]`. */
export const redactParams = (
  params: Params,
  keep: Redaction['params'],
): Params =>
  keep === 'all'
    ? params
    : Object.fromEntries(
        Object.entries(params).map(([key, value]) => [
          key,
          value === null || keep.includes(key) ? value : REDACTED,
        ]),
      );

const withoutMessage = <E extends { message?: string }>({
  message: _message,
  ...rest
}: E): Omit<E, 'message'> => rest;

export const redactEvent = (
  event: RouterEvent,
  { params, messages }: Redaction,
): RouterEvent => {
  switch (event.type) {
    case 'transition':
      return {
        ...event,
        fromParams: redactParams(event.fromParams, params),
        toParams: redactParams(event.toParams, params),
      };
    case 'invalid':
      return { ...event, toParams: redactParams(event.toParams, params) };
    case 'current':
      return { ...event, params: redactParams(event.params, params) };
    case 'result':
      return messages ? event : withoutMessage(event);
    case 'resolve':
      return messages ? event : withoutMessage(event);
    default:
      return event;
  }
};

/** What two redactions applied one after the other leave: the keys both keep, and messages only if both keep them. */
export const combineRedaction = (
  first: Redaction,
  second: Redaction,
): Redaction => ({
  params:
    first.params === 'all'
      ? second.params
      : second.params === 'all'
        ? first.params
        : first.params.filter((key) => second.params.includes(key)),
  messages: first.messages && second.messages,
});

/** The session with `redaction` applied on top of whatever it already scrubbed. */
export const redactSession = (
  session: Session,
  redaction: Redaction,
): Session => ({
  ...session,
  redaction: combineRedaction(session.redaction, redaction),
  events: session.events.map((event) => redactEvent(event, redaction)),
});
