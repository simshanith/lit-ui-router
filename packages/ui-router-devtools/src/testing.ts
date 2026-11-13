import { fold } from './fold.ts';
import type { Recorder } from './recorder.ts';
import type { Outcome, Params, Session } from './schema.ts';

export interface NormalisedTransition {
  id: number | null;
  from: string;
  to: string;
  outcome: Outcome | 'running';
  reason: string | null;
  redirectedFrom: number | null;
  entered: string[];
  exited: string[];
  retained: string[];
  params: Params;
}

// Transitions in start order with times and durations removed, so the list is snapshot-stable.
export const transitions = (
  session: Session | Recorder,
): NormalisedTransition[] => {
  const events =
    'session' in session ? session.session().events : session.events;

  return fold(events).txs.map((tx) => ({
    id: tx.id < 0 ? null : tx.id,
    from: tx.from,
    to: tx.to,
    outcome: tx.result?.outcome ?? 'running',
    reason: tx.result?.reason ?? null,
    redirectedFrom: tx.redirectedFrom,
    entered: tx.entering,
    exited: tx.exiting,
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
