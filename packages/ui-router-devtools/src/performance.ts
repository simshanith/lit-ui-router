import { fold, type Tx } from './fold.ts';
import { pathText, resultLine, seq } from './notation.ts';
import type { Recorder } from './recorder.ts';
import type { RouterEvent } from './schema.ts';

const TRACK_GROUP = 'UI-Router';

const FAULTS = new Set(['error', 'invalid']);

type Color = 'primary' | 'secondary' | 'tertiary' | 'error';

const entry = (
  name: string,
  start: number,
  end: number,
  track: string,
  color: Color,
  properties: [string, string][],
  tooltipText: string,
) =>
  performance.measure(name, {
    start,
    end: Math.max(end, start),
    detail: {
      devtools: {
        dataType: 'track-entry',
        track,
        trackGroup: TRACK_GROUP,
        color,
        properties,
        tooltipText,
      },
    },
  });

const reportPhases = (tx: Tx, end: number) => {
  const open = new Map<string, number>();

  for (const mark of tx.marks) {
    const key = `${mark.phase} ${mark.state ?? ''}`.trim();

    if (mark.edge === 'start') open.set(key, mark.t);
    else if (mark.edge === 'end' && open.has(key)) {
      entry(
        key,
        open.get(key)!,
        mark.t,
        'Phases',
        'secondary',
        [['transition', seq(tx.id)]],
        key,
      );
      open.delete(key);
    }
  }

  // A phase cut short by a redirect or supersede closes at the result.
  for (const [key, start] of open)
    entry(
      key,
      start,
      end,
      'Phases',
      'secondary',
      [
        ['transition', seq(tx.id)],
        ['closed', 'at result'],
      ],
      key,
    );
};

const reportTx = (tx: Tx) => {
  const result = tx.result;

  if (!result) return;
  const fault = FAULTS.has(result.outcome);
  const name = `${seq(tx.id)} ${tx.to}`.trim();

  const properties: [string, string][] = [
    ['from', tx.from || '(root)'],
    ['to', tx.to],
    ['outcome', result.outcome],
    ['path', pathText(tx)],
  ];

  const text = resultLine(tx);

  if (text) properties.push(['reason', text]);
  entry(
    name,
    tx.t,
    result.t,
    'Transitions',
    fault ? 'error' : 'primary',
    properties,
    `${result.outcome}: ${tx.to}`,
  );
  performance.mark(`ui-router ${seq(tx.id)} start`, { startTime: tx.t });
  performance.mark(`ui-router ${seq(tx.id)} ${result.outcome}`, {
    startTime: result.t,
  });

  if (tx.id < 0) return;
  reportPhases(tx, result.t);

  for (const r of tx.resolves.filter((r) => !r.cached))
    entry(
      r.token,
      r.start,
      r.end,
      'Resolves',
      r.ok ? 'tertiary' : 'error',
      [
        ['transition', seq(tx.id)],
        ['state', r.state],
        ['ok', String(r.ok)],
      ],
      `${r.token} (${r.state})`,
    );
};

// Writes settled transitions as User Timing entries; with a recorder it keeps reporting until the returned function is called.
export function reportToPerformance(
  source: readonly RouterEvent[] | Recorder,
): () => void {
  if (!('subscribe' in source)) {
    fold(source).txs.forEach(reportTx);

    return () => {};
  }

  const recorder = source;

  return recorder.subscribe((event) => {
    if (event.type !== 'result' && event.type !== 'invalid') return;
    const key = event.type === 'result' ? event.id : -event.seq;
    const tx = fold(recorder.events).txs.find((t) => t.id === key);

    if (tx) reportTx(tx);
  });
}
