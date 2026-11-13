import { html, nothing, type TemplateResult } from 'lit';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';
import type { Tx } from '../fold.ts';
import { ms, pathText, seq, type Status } from '../notation.ts';
import { statusGlyph, statusLabel } from './glyphs.ts';
import { renderPath, valueCell } from './log.ts';

const statusOf = (tx: Tx): Status => tx.result?.outcome ?? 'running';

const tickId = (tx: Tx): string =>
  tx.id < 0 ? `tick-n${-tx.id}` : `tick-${tx.id}`;

const tickLabel = (host: UIRouterDevtools, tx: Tx): string => {
  const duration = tx.id < 0 ? undefined : host._duration(tx);
  const took = duration === undefined ? '' : `, ${ms(duration)}`;

  return `${seq(tx.id)} ${statusLabel[statusOf(tx)]}: ${pathText(tx)}${took}`.trim();
};

const KEYS = new Map<string, (index: number, last: number) => number>([
  ['ArrowRight', (index, last) => Math.min(last, index + 1)],
  ['ArrowLeft', (index) => Math.max(0, index - 1)],
  ['Home', () => 0],
  ['End', (_index, last) => last],
]);

const MIRRORED = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

const onKey = (host: UIRouterDevtools, event: KeyboardEvent, txs: Tx[]) => {
  const rtl = getComputedStyle(host).direction === 'rtl';
  const move = KEYS.get((rtl && MIRRORED.get(event.key)) || event.key);
  const at = txs.findIndex((tx) => tx.id === host._selectedTx);

  if (event.key === 'Escape' && at >= 0) host._selectTx(null);
  else if (move && txs.length)
    host._selectTx(txs[at < 0 ? txs.length - 1 : move(at, txs.length - 1)].id);
  else return;

  event.preventDefault();
};

// The Map's transition log: one outcome glyph per transition, oldest first, with the selected row's notation beside it.
export const renderScrubber = (host: UIRouterDevtools): TemplateResult => {
  const txs = host._model.txs;
  const selected = host._tx(host._selectedTx);
  const origin = selected && host._origin(selected);

  const shown =
    host._tx(host._previewTx) ??
    selected ??
    txs.findLast((tx) => tx.result?.outcome !== 'ignored') ??
    txs.at(-1);

  const preview = (id: number | null) => () => (host._previewTx = id);

  /* oxlint-disable lit-a11y/click-events-have-key-events -- the listbox's keydown handler selects for every option */
  return html`<div class="scrubber">
    <h2 class="section" id="h-scrub">
      <span class="num">2</span><span class="title">Transitions</span>
    </h2>
    ${
      txs.length
        ? html`<div
            class="ticks"
            role="listbox"
            aria-labelledby="h-scrub"
            aria-orientation="horizontal"
            tabindex="0"
            aria-activedescendant=${selected ? tickId(selected) : nothing}
            @keydown=${(event: KeyboardEvent) => onKey(host, event, txs)}
          >
            ${txs.map((tx) => {
              const on = tx.id === selected?.id;

              return html`<span
                role="option"
                id=${tickId(tx)}
                class="tick status-${statusOf(tx)} ${on ? 'on' : ''} ${tx.id === origin?.id ? 'origin' : ''}"
                aria-selected=${on}
                aria-label=${tickLabel(host, tx)}
                title=${tickLabel(host, tx)}
                @click=${() => host._selectTx(on ? null : tx.id)}
                @mouseenter=${preview(tx.id)}
                @mouseleave=${preview(null)}
                >${statusGlyph(statusOf(tx))}</span
              >`;
            })}
          </div>`
        : nothing
    }
    ${
      shown
        ? html`<span class="now"
            ><span class="seq num">${seq(shown.id)}</span>${statusGlyph(
              statusOf(shown),
            )}${renderPath(shown)}${valueCell(host, shown, statusOf(shown))}</span
          >`
        : html`<span class="now muted">No transitions yet.</span>`
    }
  </div>`;
  /* oxlint-enable lit-a11y/click-events-have-key-events */
};
