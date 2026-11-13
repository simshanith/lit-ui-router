// The Timeline's code, loaded on first use of the Timeline view so a panel that never shows it does not pay for it.
import { html, nothing, type TemplateResult } from 'lit';
import type { DevtoolsPanel } from './panel.ts';
import type { Tx } from '../fold.ts';
import type { SpanAttributeValue } from '../schema.ts';
import { seq } from '../notation.ts';
import { foldGlyph, statusGlyph, statusLabel } from './glyphs.ts';
import {
  rowsOf,
  ticks,
  waterfall,
  type Bar,
  type Relation,
  type Waterfall,
  type WaterfallRow,
} from './waterfall.ts';

export { timelineStyles } from './timeline-styles.ts';

// Under a tenth of a millisecond a duration rounds to nothing, so it says so.
const duration = (value: number): string => {
  if (value <= 0) return '0 ms';

  if (value < 0.1) return '<0.1 ms';

  if (value < 10) return `${value.toFixed(1)} ms`;

  return value < 1000
    ? `${Math.round(value)} ms`
    : `${(value / 1000).toFixed(2)} s`;
};

// A start is read against its neighbours, so one under a tenth of a millisecond is the axis's zero.
const offset = (value: number): string =>
  value < 0.1 ? '+0' : `+${duration(value).replace(' ms', '')}`;

// A gridline's label past this share of the axis would run into the columns after it.
const LAST_LABEL = 0.85;

const RELATION_TAG: Record<Relation, string | null> = {
  child: null,
  trace: 'in trace',
  during: 'during',
};

const RELATION_TEXT: Record<Relation, string> = {
  child: 'child of the router’s span',
  trace: 'same trace, during the transition',
  during: 'during the transition, not traced to it',
};

// Bars carry their place as fractions of the track; a bar narrower than a pixel is still drawn at 2px.
const place = (bar: Bar, axis: Waterfall): string =>
  bar.start === null || bar.end === null
    ? ''
    : `--s:${(bar.start - axis.zero) / axis.length};--w:${Math.max(0, bar.end - bar.start) / axis.length}`;

const tags = (bar: Bar): string[] =>
  [
    bar.note,
    bar.relation && RELATION_TAG[bar.relation],
    bar.running ? 'running' : null,
  ].filter((tag): tag is string => Boolean(tag));

const timeOf = (bar: Bar, axis: Waterfall) =>
  bar.start === null || bar.end === null
    ? null
    : { at: bar.start - axis.zero, took: bar.end - bar.start };

/** What a row says to assistive technology: its name, when it ran, how long, and what the bar leaves out. */
export const describeBar = (bar: Bar, axis: Waterfall): string => {
  const time = timeOf(bar, axis);

  const status = bar.status
    ? `${seq(bar.tx)} ${statusLabel[bar.status]}: `
    : '';

  const when = time
    ? `, at ${duration(time.at)}, ${bar.running ? 'running for' : 'took'} ${duration(time.took)}`
    : '';

  const notes = tags(bar).filter((tag) => tag !== 'running');

  return `${status}${bar.name}${when}${notes.length ? `, ${notes.join(', ')}` : ''}`;
};

const barClass = (bar: Bar): string => {
  const phase = bar.kind === 'phase' ? bar.name.split(' ')[0] : '';

  return [
    `bar-${bar.kind}`,
    phase && `phase-${phase}`,
    bar.state && bar.kind === 'phase' ? 'per-state' : '',
    bar.fault ? 'fault' : '',
    bar.running ? 'running' : '',
    bar.relation ? `rel-${bar.relation}` : '',
    bar.status ? `status-${bar.status}` : '',
  ]
    .filter(Boolean)
    .join(' ');
};

const MIRRORED: ReadonlyMap<string, string> = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

const toggle = (host: DevtoolsPanel, key: string, collapse: boolean) => {
  const next = new Set(host._timelineCollapsed);

  if (collapse) next.add(key);
  else next.delete(key);
  host._timelineCollapsed = next;
};

const select = (host: DevtoolsPanel, key: string) => {
  host._timelineFocus = key;
  host._timelineSelected = host._timelineSelected === key ? null : key;
};

type Move = (
  rows: readonly WaterfallRow[],
  index: number,
) => WaterfallRow | undefined;

const MOVES: ReadonlyMap<string, Move> = new Map<string, Move>([
  ['ArrowDown', (rows, index) => rows[index + 1]],
  ['ArrowUp', (rows, index) => rows[index - 1]],
  ['Home', (rows) => rows[0]],
  ['End', (rows) => rows.at(-1)],
]);

// Right opens a closed item or moves into an open one; left closes an open item or moves to its parent.
const openOrMove = (
  host: DevtoolsPanel,
  key: string,
  rows: readonly WaterfallRow[],
  index: number,
): WaterfallRow | undefined => {
  const row = rows[index];

  if (key === 'ArrowRight') {
    if (row.expanded === false) toggle(host, row.bar.key, false);

    return row.expanded ? rows[index + 1] : undefined;
  }

  if (row.expanded) {
    toggle(host, row.bar.key, true);

    return undefined;
  }

  return rows.find((each) => each.bar.key === row.parent);
};

// The arrow keys move in tree order, as in the Outline; Enter and Space show a bar's details, and Escape hides them.
const onKey = (
  host: DevtoolsPanel,
  event: KeyboardEvent,
  rows: readonly WaterfallRow[],
  focus: string | undefined,
) => {
  const index = rows.findIndex((row) => row.bar.key === focus);
  const row = rows[index];
  const rtl = getComputedStyle(host).direction === 'rtl';
  const key = (rtl && MIRRORED.get(event.key)) || event.key;
  const move = MOVES.get(key);

  if (!row) return;

  let target: WaterfallRow | undefined;

  if (move) target = move(rows, index);
  else if (key === 'ArrowRight' || key === 'ArrowLeft')
    target = openOrMove(host, key, rows, index);
  else if (key === 'Enter' || key === ' ') select(host, row.bar.key);
  else if (key === 'Escape' && host._timelineSelected)
    host._timelineSelected = null;
  else return;

  event.preventDefault();

  if (!target) return;

  host._timelineFocus = target.bar.key;
  host._moveFocus = true;
};

const renderAxis = (axis: Waterfall) =>
  html`<div class="tl-row tl-axis" aria-hidden="true">
    <span class="tl-name">Name</span>
    <span class="tl-track">
      ${ticks(axis.length)
        .filter((tick) => tick === 0 || tick / axis.length <= LAST_LABEL)
        .map(
          (tick, index) =>
            html`<span
              class="num tl-tick ${index % 2 ? 'odd' : ''}"
              style="--s:${tick / axis.length}"
              >${duration(tick)}</span
            >`,
        )}
    </span>
    <span class="tl-at">At</span>
    <span class="tl-took">Took</span>
  </div>`;

const renderName = (host: DevtoolsPanel, row: WaterfallRow) => {
  const { bar } = row;

  /* oxlint-disable lit-a11y/click-events-have-key-events -- the arrow keys open and close the item, as the tree pattern has them */
  return html`<span class="tl-name"
    >${
      row.expanded === null
        ? html`<span class="tl-fold"></span>`
        : html`<span
            class="tl-fold"
            @click=${(event: Event) => {
              event.stopPropagation();
              toggle(host, bar.key, Boolean(row.expanded));
            }}
            >${foldGlyph(row.expanded)}</span
          >`
    }${
      bar.status
        ? html`${statusGlyph(bar.status)}<span class="seq"
              >${seq(bar.tx)}</span
            >`
        : nothing
    }<span class="name" title=${bar.name}>${bar.name}</span>${tags(bar).map(
      (tag) => html`<span class="tag">${tag}</span>`,
    )}</span
  >`;
  /* oxlint-enable lit-a11y/click-events-have-key-events */
};

const renderRow = (
  host: DevtoolsPanel,
  row: WaterfallRow,
  axis: Waterfall,
  focus: string | undefined,
) => {
  const { bar } = row;
  const time = timeOf(bar, axis);
  const selected = host._timelineSelected === bar.key;

  /* oxlint-disable lit-a11y/click-events-have-key-events -- the tree's keydown handler moves focus and selects for every treeitem */
  return html`<div
    role="treeitem"
    class="tl-row ${selected ? 'selected' : ''}"
    tabindex=${bar.key === focus ? 0 : -1}
    aria-level=${row.level}
    aria-setsize=${row.setsize}
    aria-posinset=${row.posinset}
    aria-expanded=${row.expanded === null ? nothing : row.expanded ? 'true' : 'false'}
    aria-selected=${selected}
    aria-label=${describeBar(bar, axis)}
    style="--level:${row.level - 1}"
    @click=${() => select(host, bar.key)}
    @focus=${() => (host._timelineFocus = bar.key)}
  >
    ${renderName(host, row)}
    <span class="tl-track" aria-hidden="true"
      >${
        time
          ? html`<span
              class="tl-bar ${barClass(bar)}"
              style=${place(bar, axis)}
            ></span>`
          : nothing
      }</span
    >
    <span class="num tl-at">${time ? offset(time.at) : nothing}</span>
    <span class="num tl-took">${time ? duration(time.took) : '—'}</span>
  </div>`;
  /* oxlint-enable lit-a11y/click-events-have-key-events */
};

type Fact = readonly [term: string, value: string];

const timeFacts = (bar: Bar, axis: Waterfall): Fact[] => {
  const time = timeOf(bar, axis);

  if (!time) return [['Time', bar.note ?? 'untimed']];

  return [
    ['Starts', duration(time.at)],
    ['Took', `${duration(time.took)}${bar.running ? ', running' : ''}`],
  ];
};

const facts = (bar: Bar, axis: Waterfall): Fact[] => {
  const list: Fact[] = [['Kind', bar.kind]];

  if (bar.state && bar.kind !== 'transition') list.push(['State', bar.state]);
  list.push(...timeFacts(bar, axis));

  if (bar.relation) list.push(['Joined', RELATION_TEXT[bar.relation]]);

  if (bar.span)
    list.push(
      ['Status', bar.span.status ?? 'unset'],
      ['Trace', bar.span.traceId],
      ['Span', bar.span.spanId],
    );

  return list;
};

const attributeText = (value: SpanAttributeValue): string =>
  Array.isArray(value) ? value.map(String).join(', ') : String(value);

const renderDetail = (bar: Bar | undefined, axis: Waterfall) => {
  if (!bar) return nothing;

  const attributes = Object.entries(bar.span?.attributes ?? {});

  return html`<section
    class="tl-detail"
    tabindex="0"
    aria-labelledby="h-tl-detail"
  >
    <h3 class="insp-title" id="h-tl-detail">
      <span class="name">${bar.name}</span>
    </h3>
    <dl class="facts">
      ${facts(bar, axis).map(
        ([term, value]) =>
          html`<dt>${term}</dt>
            <dd>${value}</dd>`,
      )}
    </dl>
    ${
      attributes.length
        ? html`<dl class="facts attributes">
            ${attributes.map(
              ([key, value]) =>
                html`<dt class="num-start" title=${key}>${key}</dt>
                  <dd>${attributeText(value)}</dd>`,
            )}
          </dl>`
        : nothing
    }
  </section>`;
};

const shownTx = (host: DevtoolsPanel): Tx | undefined =>
  host._focusTx ??
  host._model.txs.findLast((tx) => tx.result?.outcome !== 'ignored') ??
  host._model.txs.at(-1);

/** The Timeline of the transition in focus, else the latest: its redirect chain, phases, resolves and joined spans. */
export const renderTimeline = (host: DevtoolsPanel): TemplateResult => {
  const tx = shownTx(host);

  if (!tx) return html`<p class="empty">No transitions yet.</p>`;

  if (tx.id < 0)
    return html`<p class="empty">
      Invalid target <span class="name">${tx.to}</span>: no transition ran.
    </p>`;

  const axis = waterfall({ ...host._timelineInput(), tx });
  const rows = rowsOf(axis.roots, host._timelineCollapsed);

  const focus =
    rows.find((row) => row.bar.key === host._timelineFocus)?.bar.key ??
    rows[0]?.bar.key;

  const selected = rows.find(
    (row) => row.bar.key === host._timelineSelected,
  )?.bar;

  const tick = ticks(axis.length)[1];

  return html`<div
    class="timeline"
    ?data-detail=${Boolean(selected)}
    style="--tick:${tick ? tick / axis.length : 1}"
  >
    <div class="tl-main">
      ${renderAxis(axis)}
      <div
        class="tl-tree"
        role="tree"
        aria-labelledby="h-states"
        @keydown=${(event: KeyboardEvent) => onKey(host, event, rows, focus)}
      >
        ${rows.map((row) => renderRow(host, row, axis, focus))}
      </div>
    </div>
    ${renderDetail(selected, axis)}
  </div>`;
};
