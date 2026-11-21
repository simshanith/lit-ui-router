/**
 * Test helpers: a snapshot-stable list of the recorded transitions, and a promise that waits for them to settle.
 *
 * @module
 */
import { fold } from './fold.ts';
import type { Recorder } from './recorder.ts';
import type { Outcome, Params, Session } from './schema.ts';

/** A recorded transition without its times, from {@link transitions}. */
export interface NormalisedTransition {
  /** Null for a target that names no state, which core never makes a Transition. */
  id: number | null;
  /** The state the transition left; `''` is the root. */
  from: string;
  /** The state the transition targets. */
  to: string;
  /** How the transition settled, or `running` if it has not. */
  outcome: Outcome | 'running';
  /** The transition that took over: a redirect's successor, or the one that superseded this one. */
  by: number | null;
  /** The result's message, such as a rejection's; null when it has none. */
  message: string | null;
  /** The transition this one redirected from; null when it is not a redirect. */
  redirectedFrom: number | null;
  /** The states the transition enters. */
  entering: string[];
  /** The states the transition exits. */
  exiting: string[];
  /** The states the transition keeps. */
  retained: string[];
  /** The target's params. */
  params: Params;
}

/** Transitions in start order with times and durations removed, so the list is snapshot-stable; a recorder's params keep their values. */
export const transitions = (
  source: Session | Recorder,
): NormalisedTransition[] => {
  const events =
    'session' in source
      ? source.session({ params: 'all' }).events
      : source.events;

  return fold(events).txs.map((tx) => ({
    id: tx.id < 0 ? null : tx.id,
    from: tx.from,
    to: tx.to,
    outcome: tx.result?.outcome ?? 'running',
    by: tx.result?.by ?? null,
    message: tx.result?.message ?? null,
    redirectedFrom: tx.redirectedFrom,
    entering: tx.entering,
    exiting: tx.exiting,
    retained: tx.retained,
    params: tx.toParams,
  }));
};

const running = (recorder: Recorder): number =>
  fold(recorder.events).txs.filter((tx) => !tx.result).length;

/** Resolves once no recorded transition is running; a redirect's successor starts before its origin settles. */
export const settled = (recorder: Recorder): Promise<void> =>
  new Promise((resolve) => {
    const check = () => {
      if (running(recorder)) return;
      off();
      resolve();
    };

    const off = recorder.subscribe(() => queueMicrotask(check));
    queueMicrotask(check);
  });
