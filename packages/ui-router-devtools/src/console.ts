import { durationOf, fold, type Tx } from './fold.ts';
import {
  ms,
  paramText,
  pathText,
  resultLine,
  sameParam,
  seq,
  sourceTags,
  statusText,
} from './notation.ts';
import type { Recorder } from './recorder.ts';
import type { Params, RouterEvent } from './schema.ts';

const DIM = 'color: GrayText';

const paramRows = (before: Params, after: Params) =>
  Object.fromEntries(
    [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(
      (key) =>
        sameParam(before[key], after[key])
          ? []
          : [
              [
                key,
                {
                  before: paramText(before[key]),
                  after: paramText(after[key]),
                },
              ] as const,
            ],
    ),
  );

const phaseLine = (tx: Tx): string =>
  tx.marks
    .filter((mark) => mark.edge === 'start')
    .map(
      (mark) =>
        `${mark.phase}${mark.state ? ` ${mark.state}` : ''} +${ms(mark.t - tx.t)}`,
    )
    .join(', ');

const reportTx = (txs: readonly Tx[], tx: Tx) => {
  const result = tx.result;

  if (!result) return;
  const tags = sourceTags(tx).map((tag) => tag.toUpperCase());
  const took = tx.id < 0 ? '' : ms(durationOf(txs, tx, result.t));

  const header = [
    seq(tx.id),
    statusText[result.outcome],
    pathText(tx),
    ...tags,
    took,
  ]
    .filter(Boolean)
    .join(' ');

  console.groupCollapsed(header);

  const text = resultLine(tx);

  if (result.outcome === 'error' || result.outcome === 'invalid')
    console.error(text);
  else if (text) console.log(`%c${text}`, DIM);
  const diff = paramRows(tx.fromParams, tx.toParams);

  if (Object.keys(diff).length) console.table(diff);
  const phases = phaseLine(tx);

  if (phases) console.log(`%c${phases}`, DIM);

  for (const r of tx.resolves.filter((r) => !r.cached))
    console.log(
      `%cresolve ${r.token} (${r.state}) ${ms(r.end - r.start)}${r.ok ? '' : ' failed'}`,
      DIM,
    );
  console.groupEnd();
};

// One collapsed console group per settled transition; with a recorder it keeps reporting until the returned function is called.
export function reportToConsole(
  source: readonly RouterEvent[] | Recorder,
): () => void {
  if (!('subscribe' in source)) {
    const { txs } = fold(source);
    txs.forEach((tx) => reportTx(txs, tx));

    return () => {};
  }

  const recorder = source;

  return recorder.subscribe((event) => {
    if (event.type !== 'result' && event.type !== 'invalid') return;
    const key = event.type === 'result' ? event.id : -event.seq;
    const { txs } = fold(recorder.events);
    const tx = txs.find((t) => t.id === key);

    if (tx) reportTx(txs, tx);
  });
}
