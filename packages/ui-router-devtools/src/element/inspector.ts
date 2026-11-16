import { html, nothing, type TemplateResult } from 'lit';
import type { DevtoolsPanel } from './panel.ts';
import { bareName, type Tx } from '../fold.ts';
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
  copiedGlyph,
  copyGlyph,
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

const COPIED_MS = 1500;

// Without the Clipboard API, the copied text is selected in place for the viewer to copy by hand.
const copy = async (
  host: DevtoolsPanel,
  key: string,
  what: string,
  text: string,
  source: Element,
) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const node = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const shown = node.nextNode()!;
    getSelection()!.setBaseAndExtent(shown, 0, shown, text.length);
    host._announcement = `Could not copy; the ${what} is selected`;

    return;
  }

  host._announcement = `Copied ${text}`;
  host._copied = key;
  clearTimeout(host._copiedTimer);
  host._copiedTimer = setTimeout(() => (host._copied = null), COPIED_MS);
};

// Copies `text`, which the element before the button shows.
const copyButton = (
  host: DevtoolsPanel,
  key: string,
  what: string,
  text: string,
) => {
  const label = `Copy ${what}`;
  const copied = host._copied === key;

  return html`<button
    class="icon copy"
    aria-label=${label}
    title=${label}
    ?data-copied=${copied}
    @click=${(e: Event) => {
      // SAFETY: the listener is on this <button>, which always follows the text it copies
      const source = (e.currentTarget as Element).previousElementSibling!;
      void copy(host, key, what, text, source);
    }}
  >
    ${copied ? copiedGlyph : copyGlyph}
  </button>`;
};

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

  const values = state.name === current.name ? current.params : {};

  return html`<div class="inspector">
    <p class="insp-title ${host._depthClass(state.name)}">
      ${roleGlyph(role, state.abstract)}<span class="name">${state.name}</span
      >${copyButton(host, `name ${state.name}`, 'state name', bareName(state.name))}
      ${
        host._canGo(state)
          ? html`<button class="go" @click=${() => host._go(state)}>Go</button>`
          : nothing
      }
    </p>
    <dl class="facts">
      <dt>Status</dt>
      <dd>${roleLabel[role]}</dd>
      <dt>URL</dt>
      ${
        state.url
          ? html`<dd class="literal copyable">
              <span>${state.url}</span
              >${copyButton(host, `url ${state.name}`, 'URL', state.url)}
            </dd>`
          : html`<dd class="literal">—</dd>`
      }
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
