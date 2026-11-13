import {
  html,
  LitElement,
  nothing,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import type { UIRouter } from '@uirouter/core';
import { record, type Recorder } from './recorder.ts';
import {
  ancestorsOf,
  apply,
  durationOf,
  emptyModel,
  fold,
  originOf,
  type Model,
  type Tx,
} from './fold.ts';
import { ms, seq } from './notation.ts';
import {
  SCHEMA_VERSION,
  type Params,
  type Session,
  type StateInfo,
} from './schema.ts';
import {
  closeGlyph,
  statusGlyph,
  statusLabel,
  type Role,
  type Status,
} from './element/glyphs.ts';
import { styles } from './element/styles.ts';
import { renderMap, renderOutline } from './element/tree.ts';
import { renderLog } from './element/log.ts';
import {
  renderRouterCard,
  renderStateInspector,
  renderTxInspector,
} from './element/inspector.ts';

export interface Row {
  state: StateInfo;
  depth: number;
  hasChildren: boolean;
  setsize: number;
  posinset: number;
}

type Inspect = 'none' | 'router' | 'state' | 'tx';

const elide = (name: string): string => {
  if (name.length <= 28) return name;

  return `…${name.split('.').slice(-2).join('.')}`;
};

export class UIRouterDevtools extends LitElement {
  static styles: CSSResultGroup = styles;

  static properties: PropertyDeclarations = {
    router: { attribute: false },
    history: { type: Number },
    timeResolves: { type: Boolean, attribute: 'time-resolves' },
    _live: { state: true },
    _imported: { state: true },
    _tab: { state: true },
    _view: { state: true },
    _selectedTx: { state: true },
    _previewTx: { state: true },
    _selectedState: { state: true },
    _inspect: { state: true },
    _focusState: { state: true },
    _collapsed: { state: true },
    _announcement: { state: true },
    _now: { state: true },
  };

  declare router: UIRouter | undefined;
  declare history: number;
  /** Time resolves by wrapping their `resolveFn`; read when the router attaches. */
  declare timeResolves: boolean;
  declare _live: Model;
  declare _imported: { session: Session; model: Model } | null;
  declare _tab: 'tree' | 'log';
  declare _view: 'outline' | 'map';
  declare _selectedTx: number | null;
  declare _previewTx: number | null;
  declare _selectedState: string | null;
  declare _inspect: Inspect;
  declare _focusState: string | null;
  declare _collapsed: ReadonlySet<string>;
  declare _announcement: string;
  declare _now: number;

  _mapWidths: Map<string, number> = new Map();
  _moveFocus = false;
  #recorder: Recorder | undefined;
  #attached: UIRouter | undefined;
  #unsubscribe: (() => void) | undefined;
  #ticker: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super();
    this.history = 500;
    this.timeResolves = false;
    this._live = emptyModel();
    this._imported = null;
    this._tab = 'tree';
    this._view = 'outline';
    this._inspect = 'none';
    this.#resetSelection();
    this._collapsed = new Set();
    this._announcement = '';
    this._now = performance.now();
  }

  // The recorder behind the panel, for reporters that should share it.
  get recorder(): Recorder | undefined {
    return this.#recorder;
  }

  get _model(): Model {
    return this._imported?.model ?? this._live;
  }

  connectedCallback(): void {
    super.connectedCallback();

    if (this.router && !this.#recorder) this.#attach(this.router);

    // Removal from the document closes every popover; a reconnected element shows its pill again.
    if (this.hasUpdated) this.#pill?.showPopover();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#detach();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('router') && this.#attached !== this.router) {
      this.#detach();
      this._live = emptyModel();
      this.#resetSelection();

      if (this.router && this.isConnected) this.#attach(this.router);
    }

    const running =
      Boolean(this.#recorder) &&
      !this._imported &&
      this._live.txs.some((tx) => !tx.result);

    if (running && !this.#ticker)
      this.#ticker = setInterval(() => (this._now = performance.now()), 100);

    if (!running && this.#ticker) {
      clearInterval(this.#ticker);
      this.#ticker = undefined;
    }
  }

  protected firstUpdated(): void {
    if (this.isConnected) this.#pill?.showPopover();
  }

  protected updated(): void {
    this.#measureMap();

    if (!this._moveFocus) return;
    this._moveFocus = false;
    this.renderRoot
      .querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')
      ?.focus();
  }

  // Map columns and edge starts follow rendered label widths; a changed width re-renders once.
  #measureMap() {
    let changed = false;

    for (const node of this.renderRoot.querySelectorAll<HTMLElement>(
      '.map-node',
    )) {
      const name = node.dataset.name!;
      const width = Math.ceil(node.getBoundingClientRect().width);

      if (width && this._mapWidths.get(name) !== width) {
        this._mapWidths.set(name, width);
        changed = true;
      }
    }

    if (changed) this.requestUpdate();
  }

  get #pill() {
    return this.renderRoot.querySelector<HTMLElement>('.pill');
  }

  get #panel() {
    return this.renderRoot.querySelector<HTMLElement>('.panel');
  }

  #resetSelection() {
    this._selectedTx = null;
    this._previewTx = null;
    this._selectedState = null;
    this._focusState = null;

    if (this._inspect !== 'router') this._inspect = 'none';
  }

  #attach(router: UIRouter) {
    this.#attached = router;

    const recorder = record(router, {
      limit: this.history * 40,
      timeResolves: this.timeResolves,
    });

    this.#recorder = recorder;
    this._live = fold(recorder.session().events);
    this.#unsubscribe = recorder.subscribe((event) => {
      const next = apply(this._live, event);
      this._live =
        next.txs.length > this.history
          ? { ...next, txs: next.txs.slice(-this.history) }
          : next;

      if (event.type === 'result' || event.type === 'invalid')
        this.#announce(event.type === 'result' ? event.id : -event.key);
    });
  }

  #detach() {
    this.#unsubscribe?.();
    this.#recorder?.stop();
    this.#recorder = undefined;
    this.#attached = undefined;
    this.#unsubscribe = undefined;
    clearInterval(this.#ticker);
    this.#ticker = undefined;
  }

  _tx(id: number | null | undefined): Tx | undefined {
    return id == null ? undefined : this._model.txs.find((tx) => tx.id === id);
  }

  _origin(tx: Tx): Tx | undefined {
    return originOf(this._model.txs, tx);
  }

  // An imported row with no result never settles, since the exporting page's clock is not this page's.
  _end(tx: Tx): number | undefined {
    return tx.result?.t ?? (this._imported ? undefined : this._now);
  }

  _duration(tx: Tx): number | undefined {
    const end = this._end(tx);

    return end === undefined ? undefined : durationOf(this._model.txs, tx, end);
  }

  #announce(id: number) {
    if (this._imported) return;
    const tx = this._live.txs.find((t) => t.id === id);
    const outcome = tx?.result?.outcome;

    if (!tx || !outcome || !['success', 'error', 'invalid'].includes(outcome))
      return;
    this._announcement =
      outcome === 'success'
        ? `Transition ${tx.id} succeeded: ${tx.to}, ${ms(durationOf(this._live.txs, tx, this._now))}`
        : `${tx.id < 0 ? 'Target' : `Transition ${tx.id}`} failed: ${tx.to}. ${tx.result?.reason ?? ''}`;
  }

  #open() {
    this.#pill?.hidePopover();
    this.#panel?.showPopover();
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>('.close')?.focus(),
    );
  }

  #close() {
    this.#panel?.hidePopover();
    this.#pill?.showPopover();
    this.#pill?.focus();
  }

  _selectTx(id: number | null): void {
    this._selectedTx = id;
    this._inspect = id === null ? 'none' : 'tx';
  }

  _selectState(name: string): void {
    this._selectedState = this._selectedState === name ? null : name;
    this._focusState = name;
    this._inspect = this._selectedState ? 'state' : 'none';
  }

  // Session export and import

  session(): Session | undefined {
    return this._imported?.session ?? this.#recorder?.session();
  }

  importSession(session: Session): void {
    if (session.v !== SCHEMA_VERSION)
      throw new Error(
        `Unsupported session version ${String(session.v)}; expected ${String(SCHEMA_VERSION)}`,
      );
    this._imported = { session, model: fold(session.events) };
    this.#resetSelection();
    this._announcement = `Imported session ${session.routerId}, ${this._imported.model.txs.length} transitions. Live updates paused.`;
  }

  #goLive() {
    this._imported = null;
    this.#resetSelection();
    this._announcement = 'Showing the live router.';
  }

  #export() {
    const session = this.session();

    if (!session) return;

    const blob = new Blob([JSON.stringify(session, null, 1)], {
      type: 'application/json',
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ui-router-session-${session.routerId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href));
  }

  async #readFile(file: File | undefined) {
    if (!file) return;

    try {
      // SAFETY: importSession rejects any other schema version before folding the events
      this.importSession(JSON.parse(await file.text()) as Session);
    } catch (error) {
      this._announcement = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  #onDrop(event: DragEvent) {
    event.preventDefault();
    void this.#readFile(event.dataTransfer?.files[0]);
  }

  // Derived model

  get _runningTx(): Tx | undefined {
    return this._model.txs.findLast((tx) => !tx.result);
  }

  get _focusTx(): Tx | undefined {
    return (
      this._tx(this._previewTx) ?? this._tx(this._selectedTx) ?? this._runningTx
    );
  }

  #erroredState(tx: Tx): string | null {
    if (tx.result?.outcome !== 'error') return null;

    return tx.resolves.find((r) => !r.ok)?.state ?? tx.to;
  }

  _role(state: StateInfo): Role {
    const tx = this._focusTx;

    if (tx) {
      if (this.#erroredState(tx) === state.name) return 'errored';

      if (tx.entering.includes(state.name)) return 'entering';

      if (tx.exiting.includes(state.name)) return 'exiting';

      if (tx.retained.includes(state.name)) return 'retained';
    }

    const { states, current } = this._model;

    if (state.name === current.name) return 'current';

    if (ancestorsOf(states, current.name).includes(state.name))
      return 'ancestor';

    return state.future ? 'future' : 'inactive';
  }

  _children(): Map<string | null, StateInfo[]> {
    const known = new Set(this._model.states.map((s) => s.name));
    const children = new Map<string | null, StateInfo[]>();

    for (const state of this._model.states) {
      const parent =
        state.parent && known.has(state.parent) ? state.parent : null;

      children.set(parent, [...(children.get(parent) ?? []), state]);
    }

    return children;
  }

  _rows(): Row[] {
    const children = this._children();
    const rows: Row[] = [];

    const walk = (parent: string | null, depth: number) => {
      const kids = children.get(parent) ?? [];
      kids.forEach((state, index) => {
        const hasChildren = (children.get(state.name) ?? []).length > 0;
        rows.push({
          state,
          depth,
          hasChildren,
          setsize: kids.length,
          posinset: index + 1,
        });

        if (hasChildren && !this._collapsed.has(state.name))
          walk(state.name, depth + 1);
      });
    };

    walk(null, 1);

    return rows;
  }

  _paramBase(tx: Tx): Params {
    const first = (this._origin(tx) ?? tx).id;

    return (
      this._model.txs.findLast(
        (t) => t.id >= 0 && t.id < first && t.result?.outcome === 'success',
      )?.toParams ?? tx.fromParams
    );
  }

  // Render

  render(): TemplateResult {
    const inspected =
      this._inspect === 'tx' ? this._tx(this._selectedTx) : undefined;

    const imported = Boolean(this._imported);

    return html`
      ${this.#renderPill()}
      <div
        class="panel"
        popover="manual"
        role="region"
        aria-label="Router devtools"
        data-tab=${this._tab}
        data-view=${this._view}
        data-inspect=${this._inspect}
        ?data-imported=${imported}
        @dragover=${(e: DragEvent) => e.preventDefault()}
        @drop=${this.#onDrop}
      >
        ${this.#renderTitle()}
        <div class="body">
          <section
            class="pane tree-pane"
            id="pane-tree"
            role="tabpanel"
            aria-labelledby="h-states"
          >
            ${this.#sectionHead('1', 'States', 'h-states')}
            <div class="scroll outline-scroll">${renderOutline(this)}</div>
            <div class="scroll map-scroll">${renderMap(this)}</div>
          </section>
          <section
            class="pane log-pane"
            id="pane-log"
            role="tabpanel"
            aria-labelledby="h-log"
          >
            ${this.#sectionHead('2', 'Transitions', 'h-log')}
            <div class="scroll">${renderLog(this)}</div>
          </section>
          <section class="pane inspector-pane" aria-labelledby="h-insp">
            ${this.#sectionHead('3', 'Inspector', 'h-insp', inspected ? seq(inspected.id) || 'Invalid target' : this.#inspectorAside())}
            <div
              class="scroll"
              tabindex="0"
              role="group"
              aria-labelledby="h-insp"
            >
              ${this.#renderInspector(inspected)}
            </div>
          </section>
          <section
            class="pane router-pane"
            id="pane-router"
            role="tabpanel"
            aria-labelledby="h-router"
          >
            ${this.#sectionHead('3', 'Router', 'h-router')}
            <div
              class="scroll"
              tabindex="0"
              role="group"
              aria-labelledby="h-router"
            >
              ${renderRouterCard(this, true)}
            </div>
          </section>
        </div>
      </div>
      <input
        class="file visually-hidden"
        type="file"
        accept=".json,application/json"
        tabindex="-1"
        aria-hidden="true"
        @change=${(e: Event) => {
          // SAFETY: the listener is on this <input>
          const input = e.currentTarget as HTMLInputElement;
          void this.#readFile(input.files?.[0]).then(() => (input.value = ''));
        }}
      />
      <div class="visually-hidden" role="status" aria-live="polite">
        ${this._announcement}
      </div>
    `;
  }

  #inspectorAside(): string | undefined {
    if (this._inspect === 'state') return undefined;

    return this._inspect === 'none' || this._inspect === 'router'
      ? 'Router'
      : undefined;
  }

  #renderInspector(inspected: Tx | undefined) {
    if (inspected) return renderTxInspector(this, inspected);

    if (this._inspect === 'state') return renderStateInspector(this);

    return renderRouterCard(this);
  }

  #sectionHead(n: string, title: string, id: string, aside?: string) {
    return html`<h2 class="section" id=${id}>
      <span class="num">${n}</span
      ><span class="title">${title}</span
      >${aside ? html`<span class="aside">${aside}</span>` : nothing}
    </h2>`;
  }

  #summary() {
    const running = this._runningTx;

    const last = this._model.txs.findLast(
      (tx) => tx.result?.outcome !== 'ignored',
    );

    const status: Status = running
      ? 'running'
      : (last?.result?.outcome ?? 'success');

    const tx = running ?? last;
    const duration = tx && tx.id >= 0 ? this._duration(tx) : undefined;

    const name =
      running?.to ??
      (last && last.result?.outcome !== 'success'
        ? last.to
        : this._model.current.name);

    return {
      status,
      name: name || '(root)',
      took: duration === undefined ? '' : ms(duration),
    };
  }

  #renderPill() {
    const { status, name, took } = this.#summary();

    return html`<button
      class="pill status-${status}"
      popover="manual"
      @click=${this.#open}
    >
      ${statusGlyph(status)}<span class="visually-hidden"
        >Router ${statusLabel[status]}:</span
      ><span class="pill-name">${elide(name)}</span
      >${took ? html`<span class="num">${took}</span>` : nothing}${
        this._imported ? html`<span class="tag">Imported</span>` : nothing
      }
    </button>`;
  }

  #toggleRouter() {
    this._inspect = this._inspect === 'router' ? 'none' : 'router';
    this._selectedTx = null;
    this._selectedState = null;
  }

  #showTab(tab: 'tree' | 'log' | 'router') {
    if (tab === 'router') {
      this._inspect = 'router';

      return;
    }

    this._tab = tab;

    if (this._inspect === 'router') this._inspect = 'none';
  }

  #renderTabs() {
    const router = this._inspect === 'router';

    const tabs = [
      ['tree', '1', 'States', 'pane-tree', !router && this._tab === 'tree'],
      ['log', '2', 'Transitions', 'pane-log', !router && this._tab === 'log'],
      ['router', '3', 'Router', 'pane-router', router],
    ] as const;

    return html`<div class="tabs" role="tablist" aria-label="Devtools views">
      ${tabs.map(
        ([tab, n, label, id, selected]) =>
          html`<button
            role="tab"
            aria-selected=${selected}
            aria-controls=${id}
            @click=${() => this.#showTab(tab)}
          >
            <span class="num">${n}</span><span class="label">${label}</span>
          </button>`,
      )}
    </div>`;
  }

  _sessionButtons(): TemplateResult {
    return html`<button
        @click=${this.#export}
        aria-label="Export session as JSON"
      >
        Export</button
      >${
        this._imported
          ? html`<button
              @click=${this.#goLive}
              aria-label="Live: return to the live router"
            >
              Live
            </button>`
          : html`<button
              @click=${() => this.renderRoot.querySelector<HTMLInputElement>('.file')?.click()}
              aria-label="Import session from JSON"
            >
              Import
            </button>`
      }`;
  }

  #renderTitle() {
    const count = (outcome: string) =>
      this._model.txs.filter((tx) => tx.result?.outcome === outcome).length;

    const counts = [
      ['success', count('success'), 'succeeded'],
      ['error', count('error') + count('invalid'), 'failed'],
      ['redirected', count('redirected'), 'redirected'],
    ] as const;

    const imported = this._imported;

    return html`<div class="titlestrip">
      <button
        class="brand"
        aria-pressed=${this._inspect === 'router'}
        title="Router configuration"
        @click=${this.#toggleRouter}
      >
        Router
      </button>
      <div class="switch" role="group" aria-label="State view">
        ${(['outline', 'map'] as const).map(
          (view) =>
            html`<button
              aria-pressed=${this._view === view}
              @click=${() => (this._view = view)}
            >
              ${view}
            </button>`,
        )}
      </div>
      ${this.#renderTabs()}
      ${imported ? html`<span class="imported tag" title=${imported.session.routerId}>Imported</span>` : nothing}
      <span class="spacer"></span>
      <span class="counts">
        ${counts.map(
          ([status, n, label]) =>
            html`<span class="count status-${status}" title="${n} ${label}"
              ><span class="num">${n}</span>${statusGlyph(status)}<span
                class="visually-hidden"
                >${label}</span
              ></span
            >`,
        )}
      </span>
      <span class="session">${this._sessionButtons()}</span>
      <button
        class="icon close"
        aria-label="Collapse devtools"
        @click=${this.#close}
      >
        ${closeGlyph}
      </button>
    </div>`;
  }
}
