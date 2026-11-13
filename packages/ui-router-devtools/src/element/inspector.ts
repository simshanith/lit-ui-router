import { html, nothing, type TemplateResult } from 'lit';
import type { DevtoolsPanel } from './panel.ts';
import type { Tx } from '../fold.ts';
import { SCHEMA_VERSION, type LocationInfo } from '../schema.ts';
import { edgesOf } from '../edges.ts';
import { paramText, segment, seq } from '../notation.ts';
import {
  reasonLine,
  renderOptions,
  renderParams,
  renderTiming,
} from './log.ts';
import {
  markGlyph,
  roleGlyph,
  roleLabel,
  stateMarks,
  statusGlyph,
  statusLabel,
} from './glyphs.ts';

const sub = (n: string, title: string) =>
  html`<h3 class="section sub">
    <span class="num">${n}</span><span class="title">${title}</span>
  </h3>`;

// A state named in words; it selects that state and moves focus to its row or box.
const stateLink = (host: DevtoolsPanel, name: string) =>
  html`<button
    class="link ${host._depthClass(name)}"
    title=${name}
    @click=${() => host._revealState(name)}
  >
    ${segment(name)}
  </button>`;

const commas = (items: readonly unknown[]) =>
  items.map((item, index) => html`${index ? ', ' : nothing}${item}`);

const stateLinks = (host: DevtoolsPanel, names: readonly string[]) =>
  commas(names.map((name) => stateLink(host, name)));

// What the Map draws as edges for a selected transition, in words.
const renderTxPath = (host: DevtoolsPanel, tx: Tx) => {
  if (tx.id < 0) return nothing;

  const origin = host._origin(tx);

  return html`<dl class="facts">
    ${
      tx.from
        ? html`<dt>From</dt>
            <dd>${stateLink(host, tx.from)}</dd>`
        : nothing
    }${
      origin
        ? html`<dt>Redirected</dt>
            <dd>from ${seq(origin.id)}, bound for ${origin.to}</dd>`
        : nothing
    }${
      tx.exiting.length
        ? html`<dt>Exits</dt>
            <dd>${stateLinks(host, tx.exiting)}</dd>`
        : nothing
    }${
      tx.entering.length
        ? html`<dt>Enters</dt>
            <dd>${stateLinks(host, tx.entering)}</dd>`
        : nothing
    }
  </dl>`;
};

// What the Map draws as edges for a selected state, in words: successful arrivals and departures per other state.
const renderTraffic = (host: DevtoolsPanel, name: string) => {
  const seen = edgesOf(host._model).flatMap((edge) =>
    edge.outcomes.success ? [{ ...edge, count: edge.outcomes.success }] : [],
  );

  const arrived = seen.filter((edge) => edge.to === name);
  const left = seen.filter((edge) => edge.from === name && edge.to !== name);

  // One state and how often, per hop: `stars ×2`.
  const hop = (other: string, count: number) =>
    html`<span class="hop"
      >${
        other === name || !other
          ? html`<span class="muted">${other ? 'itself' : 'start'}</span>`
          : stateLink(host, other)
      }<span class="times"> ×${count}</span></span
    >`;

  return html`${
    arrived.length
      ? html`<dt>Arrived</dt>
          <dd class="traffic">
            ${arrived.map((edge) => hop(edge.from, edge.count))}
          </dd>`
      : nothing
  }${
    left.length
      ? html`<dt>Left</dt>
          <dd class="traffic">
            ${left.map((edge) => hop(edge.to, edge.count))}
          </dd>`
      : nothing
  }`;
};

export const renderTxInspector = (
  host: DevtoolsPanel,
  tx: Tx,
): TemplateResult => {
  const status = tx.result?.outcome ?? 'running';

  return html`<div class="inspector">
    <p class="insp-title">
      ${statusGlyph(status)}<span class="name">${tx.to}</span
      ><span class="visually-hidden">${statusLabel[status]}</span>
    </p>
    ${reasonLine(tx, status)} ${renderTxPath(host, tx)}
    ${renderParams(host, tx, '3.1', true)}${renderOptions(tx, '3.2')}${renderTiming(host, tx, '3.3')}
  </div>`;
};

export const renderStateInspector = (host: DevtoolsPanel): TemplateResult => {
  const { states, current } = host._model;
  const name = host._selectedState ?? current.name;
  const state = states.find((s) => s.name === name);

  if (!state) return html`<p class="empty">Select a state or transition.</p>`;
  const role = host._role(state);

  const canGo =
    !host._imported &&
    !state.abstract &&
    !state.future &&
    state.params.every((p) => p.optional) &&
    host.router;

  const values = state.name === current.name ? current.params : {};

  return html`<div class="inspector">
    <p class="insp-title ${host._depthClass(state.name)}">
      ${roleGlyph(role, state.abstract)}<span class="name">${state.name}</span>
      ${
        canGo
          ? html`<button
              class="go"
              @click=${() => void host.router?.stateService.go(state.name).catch(() => {})}
            >
              Go
            </button>`
          : nothing
      }
    </p>
    <dl class="facts">
      <dt>Status</dt>
      <dd>${roleLabel[role]}</dd>
      <dt>URL</dt>
      <dd class="literal">${state.url ?? '—'}</dd>
      ${
        state.abstract
          ? html`<dt>Abstract</dt>
              <dd>never a target itself</dd>`
          : nothing
      }
      ${stateMarks(state, states).map(
        ({ mark, term, text }) =>
          html`<dt>${term}</dt>
            <dd class="marked">${markGlyph(mark)}<span>${text}</span></dd>`,
      )}
      ${renderTraffic(host, state.name)}
    </dl>
    ${sub('3.1', 'Params')}
    ${
      state.params.length
        ? html`<dl class="params">
            ${state.params.map(
              (p) =>
                html`<dt>
                    <span class="op"></span
                    >${p.id}${p.optional ? '' : html` <span class="muted">required</span>`}
                  </dt>
                  <dd>
                    ${values[p.id] == null ? html`<span class="muted">—</span>` : paramText(values[p.id])}<span
                      class="muted"
                    >
                      ${p.type}${p.dynamic ? ', dynamic' : ''}${p.array ? ', array' : ''}</span
                    >
                  </dd>`,
            )}
          </dl>`
        : html`<p class="empty">None</p>`
    }
    ${sub('3.2', 'Resolves')}
    ${
      state.resolves.length
        ? html`<ul class="plain">
            ${state.resolves.map((r) => html`<li>${r}</li>`)}
          </ul>`
        : html`<p class="empty">None</p>`
    }
  </div>`;
};

const LOCATION: Record<LocationInfo['kind'], string> = {
  hash: 'Hash',
  pushState: 'pushState',
  memory: 'Memory',
  other: 'Other',
};

const literal = (value: string) =>
  value
    ? html`<dd class="literal">${value}</dd>`
    : html`<dd class="muted">none</dd>`;

// The router facts; the dock shows it as the inspector's default, the sheets as their own pane.
export const renderRouterCard = (
  host: DevtoolsPanel,
  actions = false,
): TemplateResult => {
  const { config, states } = host._model;
  const facts = host._sessionFacts();

  if (!config) return html`<p class="empty">No router attached.</p>`;

  return html`<div class="inspector router-card">
    <dl class="facts">
      <dt>Location</dt>
      <dd>${LOCATION[config.location.kind]}</dd>
      <dt>Base href</dt>
      ${literal(config.location.baseHref)}
      <dt>HTML5</dt>
      <dd>${config.location.html5Mode ? 'yes' : 'no'}</dd>
      <dt>Hash prefix</dt>
      ${literal(config.location.hashPrefix)}
      <dt>Strict</dt>
      <dd>${config.strictMode ? 'yes' : 'no'}</dd>
      <dt>Case</dt>
      <dd>${config.caseInsensitive ? 'insensitive' : 'sensitive'}</dd>
      <dt>States</dt>
      <dd class="num-start">${states.length}</dd>
      <dt>Events</dt>
      <dd class="num-start">${facts.events}</dd>
      ${
        facts.dropped
          ? html`<dt>Dropped</dt>
              <dd class="num-start">${facts.dropped}</dd>`
          : nothing
      }
      <dt>Session</dt>
      <dd class="literal">${facts.routerId || '—'}</dd>
      <dt>Schema</dt>
      <dd>v${SCHEMA_VERSION}, ${host._imported ? 'imported' : 'live'}</dd>
    </dl>
    ${sub('3.1', 'Plugins')}
    <ul class="plain literal">
      ${config.plugins.map((name) => html`<li>${name}</li>`)}
    </ul>
    ${sub('3.2', 'Export')} ${host._exportToggles()}
    ${actions ? html`<p class="session card-actions">${host._sessionButtons()}</p>` : nothing}
  </div>`;
};
