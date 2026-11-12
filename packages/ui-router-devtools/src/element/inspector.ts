import { html, nothing, type TemplateResult } from 'lit';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';
import type { Tx } from '../fold.ts';
import type { LocationInfo } from '../schema.ts';
import { renderOptions, renderParams, renderTiming } from './log.ts';
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

export const renderTxInspector = (
  host: UIRouterDevtools,
  tx: Tx,
): TemplateResult => {
  const status = tx.result?.outcome ?? 'running';
  const fault = status === 'error' || status === 'invalid';

  return html`<div class="inspector">
    <p class="insp-title">
      ${statusGlyph(status)}<span class="name">${tx.to}</span
      ><span class="visually-hidden">${statusLabel[status]}</span>
    </p>
    ${tx.result?.reason ? html`<p class="insp-reason ${fault ? 'fault' : ''}">${tx.result.reason}</p>` : nothing}
    ${renderParams(host, tx, '3.1', true)}${renderOptions(tx, '3.2')}${renderTiming(host, tx, '3.3')}
  </div>`;
};

export const renderStateInspector = (
  host: UIRouterDevtools,
): TemplateResult => {
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
    <p class="insp-title">
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
                    ${values[p.id] ?? html`<span class="muted">—</span>`}<span
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
  host: UIRouterDevtools,
  actions = false,
): TemplateResult => {
  const { config, states } = host._model;
  const session = host.session();

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
      <dd class="num-start">${session?.events.length ?? 0}</dd>
      <dt>Session</dt>
      <dd class="literal">${session?.routerId ?? '—'}</dd>
      <dt>Schema</dt>
      <dd>v${session?.v ?? 1}, ${host._imported ? 'imported' : 'live'}</dd>
    </dl>
    ${sub('3.1', 'Plugins')}
    <ul class="plain literal">
      ${config.plugins.map((name) => html`<li>${name}</li>`)}
    </ul>
    ${actions ? html`<p class="session card-actions">${host._sessionButtons()}</p>` : nothing}
  </div>`;
};
