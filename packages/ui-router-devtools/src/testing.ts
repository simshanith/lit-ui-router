import { fold } from './fold.ts';
import type { Recorder } from './recorder.ts';
import type { Outcome, Params, Session } from './schema.ts';

export interface NormalisedTransition {
  /** Null for a target that names no state, which core never makes a Transition. */
  id: number | null;
  from: string;
  to: string;
  outcome: Outcome | 'running';
  /** The transition that took over: a redirect's successor, or the one that superseded this one. */
  by: number | null;
  message: string | null;
  redirectedFrom: number | null;
  entering: string[];
  exiting: string[];
  retained: string[];
  params: Params;
}

// Transitions in start order with times and durations removed, so the list is snapshot-stable; a recorder's params keep their values.
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

// Resolves once no recorded transition is running; a redirect's successor starts before its origin settles.
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
