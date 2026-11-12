import { html, nothing, type TemplateResult } from 'lit';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';
import type { Tx } from '../fold.ts';
import type { Value } from '../schema.ts';
import {
  ms,
  pathParts,
  segment,
  seq,
  sourceTags,
  type Status,
} from '../notation.ts';
import { roleGlyph, statusGlyph, statusLabel } from './glyphs.ts';

const SLOW_MS = 150;

const PHASES = [
  'before',
  'start',
  'exit',
  'retain',
  'enter',
  'finish',
  'success',
  'error',
] as const;

const FAULTS: ReadonlySet<Status> = new Set(['error', 'invalid']);

type LogItem =
  | { kind: 'tx'; tx: Tx; origin?: Tx }
  | { kind: 'ignored'; txs: Tx[] };

const logItems = (host: UIRouterDevtools): LogItem[] => {
  const items: LogItem[] = [];

  for (const tx of [...host._model.txs].reverse()) {
    if (tx.result?.outcome === 'redirected' && tx.successor) continue;
    const previous = items.at(-1);

    if (tx.result?.outcome === 'ignored') {
      if (previous?.kind === 'ignored') previous.txs.push(tx);
      else items.push({ kind: 'ignored', txs: [tx] });
      continue;
    }

    items.push({ kind: 'tx', tx, origin: host._origin(tx) });
  }

  return items;
};

const reasonLine = (reason: string | null | undefined, status: Status) =>
  reason
    ? html`<p class="reason ${FAULTS.has(status) ? 'fault' : ''}">${reason}</p>`
    : nothing;

const renderIgnored = (txs: Tx[]) => {
  const ids = txs.map((tx) => seq(tx.id)).join(', ');

  return html`<li
    class="tx ignored"
    title="${ids} ignored: already at ${txs[0]?.to}"
  >
    <div class="line">
      <span class="seq"></span>${statusGlyph('ignored')}<span class="path muted"
        >${txs.length > 1 ? `${txs.length} ignored` : `ignored`}</span
      >
    </div>
    ${reasonLine(txs[0]?.result?.reason, 'ignored')}
  </li>`;
};

export const renderPath = (tx: Tx): TemplateResult => {
  if (tx.id < 0)
    return html`<span class="path"
      ><span class="entered">${tx.to}</span></span
    >`;
  const { pivot, exited, entered } = pathParts(tx);

  return html`<span class="path"
    >${pivot ? html`<span class="retained">${pivot}</span>` : nothing}${
      exited
        ? html`<span class="op">−</span><span class="exited">${exited}</span>`
        : nothing
    }${entered ? html`<span class="op">+</span><span class="entered">${entered}</span>` : nothing}</span
  >`;
};

const hidden = (s: Status) =>
  html`<span class="visually-hidden">${statusLabel[s]}</span>`;

export const valueCell = (
  host: UIRouterDevtools,
  tx: Tx,
  status: Status,
): TemplateResult => {
  const tags = sourceTags(tx);
  const muted = status === 'superseded' || status === 'aborted';
  const duration = tx.id < 0 ? undefined : host._duration(tx);

  return html`<span class="value"
    >${tags.map((tag) => html`<span class="tag source">${tag}</span>`)}${
      muted
        ? html`<span class="tag">${status}</span>`
        : duration === undefined
          ? nothing
          : html`<span class="num">${ms(duration)}</span>`
    }</span
  >`;
};

const renderTx = (host: UIRouterDevtools, tx: Tx, origin: Tx | undefined) => {
  const status: Status = tx.result?.outcome ?? 'running';
  const selected = host._selectedTx === tx.id;
  const preview = (id: number | null) => () => (host._previewTx = id);
  const muted = status === 'superseded' || status === 'aborted';

  const head = origin
    ? html`<span class="seq">${seq(origin.id)}</span
        >${statusGlyph('redirected')}${hidden('redirected')}${renderPath(
          origin,
        )}${valueCell(host, origin, 'redirected')}`
    : html`<span class="seq">${seq(tx.id)}</span
        >${statusGlyph(status)}${hidden(status)}${renderPath(tx)}${valueCell(
          host,
          tx,
          status,
        )}`;

  return html`<li
    class="tx status-${status} ${selected ? 'selected' : ''} ${muted ? 'muted' : ''}"
    @mouseenter=${preview(tx.id)}
    @mouseleave=${preview(null)}
    @focusin=${preview(tx.id)}
    @focusout=${preview(null)}
  >
    <button
      class="line"
      aria-expanded=${selected}
      @click=${() => host._selectTx(selected ? null : tx.id)}
      @mouseenter=${origin ? preview(origin.id) : nothing}
      @mouseleave=${origin ? preview(tx.id) : nothing}
    >
      ${head}
    </button>
    ${
      origin
        ? html`<div class="line chain">
            <span class="elbow" aria-hidden="true"></span
            ><span class="seq">${seq(tx.id)}</span
            >${statusGlyph(status)}${hidden(
              status,
            )}${renderPath(tx)}${valueCell(host, tx, status)}
          </div>`
        : nothing
    }
    ${reasonLine(tx.result?.reason, status)}
    ${
      selected
        ? html`<div class="detail">
            ${renderParams(host, tx, '2.1')}${renderOptions(tx, '2.2', false)}${renderTiming(host, tx, '2.3')}
          </div>`
        : nothing
    }
  </li>`;
};

export const renderLog = (host: UIRouterDevtools): TemplateResult => {
  const items = logItems(host);

  if (!items.length) return html`<p class="empty">No transitions yet.</p>`;

  return html`<ol class="log">
    ${items.map((item) => (item.kind === 'ignored' ? renderIgnored(item.txs) : renderTx(host, item.tx, item.origin)))}
  </ol>`;
};

const sub = (n: string, title: string) =>
  html`<h3 class="section sub">
    <span class="num">${n}</span><span class="title">${title}</span>
  </h3>`;

const renderResolveRow = (
  r: Tx['resolves'][number],
  pct: (t: number) => string,
) => {
  const slow = !r.cached && r.end - r.start > SLOW_MS;

  return html`<span class="wf-key">${r.token}</span>
    <div class="track">
      ${
        r.cached
          ? nothing
          : html`<span
              class="bar ${r.ok ? '' : 'failed'}"
              style="inset-inline-start:${pct(r.start)};inline-size:max(2px, calc(${pct(r.end)} - ${pct(r.start)}))"
            ></span>`
      }
    </div>
    ${
      r.cached
        ? html`<span class="tag">Cached</span>`
        : html`<span class="value"
            >${slow ? html`<span class="tag">Slow</span>` : nothing}<span
              class="num"
              >${ms(r.end - r.start)}</span
            ></span
          >`
    }`;
};

// Phases sit on an ordinal ruler with their real offsets; only resolve bars are proportional.
export const renderTiming = (
  host: UIRouterDevtools,
  tx: Tx,
  n: string,
): TemplateResult | typeof nothing => {
  if (tx.id < 0) return nothing;
  const t0 = (host._origin(tx) ?? tx).t;
  const end = host._end(tx) ?? t0;
  const total = Math.max(end - t0, ...tx.resolves.map((r) => r.end - t0), 0.1);

  const pct = (t: number) =>
    `${(Math.min(Math.max(0, t - t0), total) / total) * 100}%`;

  const phases = PHASES.flatMap((phase) => {
    const t = tx.marks.find((m) => m.phase === phase && m.edge === 'start')?.t;

    return t === undefined ? [] : [{ phase, t }];
  });

  const byState = [...tx.retained, ...tx.entering].flatMap((state) => {
    const resolves = tx.resolves.filter((r) => r.state === state);

    return resolves.length ? [{ state, resolves }] : [];
  });

  return html`${sub(n, 'Resolves')}
    <ol class="ruler" aria-label="Phases, time from start">
      ${phases.map(
        (p) =>
          html`<li class=${p.phase === 'error' ? 'fault' : ''}>
            <span class="tag">${p.phase}</span
            ><span class="num">${ms(Math.max(0, p.t - t0))}</span>
          </li>`,
      )}
    </ol>
    ${
      byState.length
        ? html`<div class="wf">
            ${byState.map(
              (group) =>
                html`${roleGlyph(tx.entering.includes(group.state) ? 'entering' : 'retained')}<span
                    class="wf-state"
                    >${segment(group.state)}</span
                  >
                  ${group.resolves.map((r) => renderResolveRow(r, pct))}`,
            )}
            <div class="axis" aria-hidden="true">
              <span class="num">0</span><span class="num">${ms(total)}</span>
            </div>
          </div>`
        : nothing
    }`;
};

const opOf = (was: Value | undefined, now: Value | undefined): string => {
  if (was === now) return '';

  if (was == null) return '+';

  return now == null ? '−' : '~';
};

export const renderParams = (
  host: UIRouterDevtools,
  tx: Tx,
  n: string,
  all = false,
): TemplateResult => {
  const before = tx.id < 0 ? {} : host._paramBase(tx);
  const after = tx.toParams;

  const keys = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((k) => before[k] != null || after[k] != null);

  const shown = all ? keys : keys.filter((k) => before[k] !== after[k]);

  return html`${sub(n, 'Params')}
  ${
    shown.length
      ? html`<dl class="params">
          ${shown.map((k) => {
            const was = before[k];
            const now = after[k];
            const op = opOf(was, now);

            return html`<dt><span class="op">${op}</span>${k}</dt>
              <dd>
                ${op === '~' ? html`<span class="muted">${was}</span> → ` : nothing}${now ?? html`<span class="muted">${was}</span>`}
              </dd>`;
          })}
        </dl>`
      : html`<p class="empty">No param changes</p>`
  }`;
};

const SOURCE_LABEL: Record<Tx['options']['source'], string> = {
  sref: 'link',
  url: 'URL',
  redirect: 'redirect',
  otherwise: 'otherwise rule',
  unknown: 'go()',
};

const yes = (value: boolean) => (value ? 'yes' : 'no');

const DEFAULTS = ['go()', 'push', 'no', 'yes', 'yes', 'no'];

// The inline detail lists only options that differ from a plain go(); the inspector lists all.
export const renderOptions = (
  tx: Tx,
  n: string,
  all = true,
): TemplateResult | typeof nothing => {
  if (tx.id < 0) return nothing;
  const { source, location, reload, inherit, supercede } = tx.options;

  const every: [string, string, boolean][] = [
    ['Source', SOURCE_LABEL[source], false],
    [
      'Location',
      location === 'replace' ? 'replace' : location ? 'push' : 'unchanged',
      false,
    ],
    [
      'Reload',
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the option's own union: a flag or the reloaded state's name
      typeof reload === 'string' ? reload : yes(reload),
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- as above
      typeof reload === 'string',
    ],
    ['Inherit', yes(inherit), false],
    ['Supersede', yes(supercede), false],
    ['Dynamic', yes(tx.dynamic), false],
  ];

  const rows = all
    ? every
    : every.filter(([, value], i) => value !== DEFAULTS[i]);

  if (!rows.length) return nothing;

  return html`${sub(n, 'Options')}
    <dl class="facts">
      ${rows.map(
        ([key, value, literal]) =>
          html`<dt>${key}</dt>
            <dd class=${literal ? 'literal' : ''}>${value}</dd>`,
      )}
    </dl>`;
};
