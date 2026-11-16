import {
  adoptStyles,
  html,
  LitElement,
  nothing,
  type CSSResult,
  type CSSResultGroup,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import type { UIRouter } from '@uirouter/core';
import { record, type Recorder } from '../recorder.ts';
import {
  ancestorsOf,
  apply,
  bareName,
  durationOf,
  emptyModel,
  fold,
  originOf,
  type Model,
  type Tx,
} from '../fold.ts';
import { ms, resultLine, seq } from '../notation.ts';
import {
  defaultRedaction,
  redactionOf,
  redactSession,
} from '@repo/router-events/redaction';
import {
  SCHEMA_VERSION,
  type Params,
  type Redaction,
  type Session,
  type SpanRecord,
  type StateInfo,
  type ViewInfo,
} from '../schema.ts';
import { spansDuring, upsertSpan } from '../spans.ts';
import type { ViewLocator } from '../views.ts';
import type { WaterfallInput } from './waterfall.ts';
import {
  closeGlyph,
  depthClass,
  maxGlyph,
  minGlyph,
  statusGlyph,
  statusLabel,
  took,
  type Role,
  type Status,
} from './glyphs.ts';
import { styles } from './styles.ts';
import { renderOutline } from './tree.ts';
import type { NestedLayout } from './nested.ts';
import type { Metrics, Size } from './pack.ts';
import type { Split } from './viewmap.ts';
import type { Rect } from './route.ts';
import { placeBeside } from './popover.ts';
import type { Room, View } from './viewport.ts';
import { renderScrubber } from './scrubber.ts';
import { renderLog } from './log.ts';
import {
  renderRouterCard,
  renderStateInspector,
  renderTxInspector,
} from './inspector.ts';

export interface Row {
  state: StateInfo;
  depth: number;
  hasChildren: boolean;
  setsize: number;
  posinset: number;
}

type Inspect = 'none' | 'router' | 'state' | 'tx' | 'view';

type MapLayout = 'nested' | 'tree';

type MapModule = typeof import('./map.ts');

type TimelineModule = typeof import('./timeline.ts');

type ViewMapModule = typeof import('./viewmap.ts');

type StateView = 'outline' | 'map' | 'timeline' | 'views';

type SessionReader = typeof import('../session-schema.ts');

// Kept outside the recorder's ring buffer, so not counted as recorded events.
const SNAPSHOTS: ReadonlySet<string> = new Set([
  'config',
  'states',
  'current',
  'views',
]);

interface SessionFacts {
  routerId: string;
  /** Recorded events, snapshots aside. */
  events: number;
  dropped: number;
}

interface Notice {
  text: string;
  fault: boolean;
}

const MAP_FAILED = 'The Map did not load. Switch views to retry.';

const TIMELINE_FAILED = 'The Timeline did not load. Switch views to retry.';

const VIEWS_FAILED = 'The Views did not load. Switch views to retry.';

const HEADINGS: Record<StateView, string> = {
  outline: 'States',
  map: 'States',
  timeline: 'Timeline',
  views: 'Views',
};

/** Below this inline size the nested layout is the Outline with borders, so it is not offered. */
const NESTED_MIN_WIDTH = 560;

/** How long boxes take to move to their new places; `nested.ts` delays edges by as much. */
const SETTLE = 200;

/** The room the dock's inspector popover takes beside the diagram: its inline size and a module either side. */
const ASIDE = 320;

const MARGIN = 12;

/** How far a press travels before it is a drag; `mapview.ts` pans past as much. */
const DRAG = 4;

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const FLIP = 'uird-flip';

const RESCALE = 'uird-rescale';

const LAYOUT_KEY = 'ui-router-devtools:map-layout';

// Storage can be blocked or throw; the preference is a convenience, so a failure is silent.
const storedLayout = (): MapLayout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'tree' ? 'tree' : 'nested';
  } catch {
    return 'nested';
  }
};

const storeLayout = (layout: MapLayout): void => {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // the choice still holds for this page
  }
};

const VIEWS_KEY = 'ui-router-devtools:map-views';

const storedViews = (): boolean => {
  try {
    return localStorage.getItem(VIEWS_KEY) !== 'off';
  } catch {
    return true;
  }
};

const storeViews = (shown: boolean): void => {
  try {
    localStorage.setItem(VIEWS_KEY, shown ? 'on' : 'off');
  } catch {
    // the choice still holds for this page
  }
};

/** The dock's width, past which the Map owns the panel and its inspector is a popover. */
const WIDE = '(width > 880px)';

const rectOf = (element: Element, origin: DOMRect): Rect => {
  const rect = element.getBoundingClientRect();

  return {
    x: Math.round(rect.x - origin.x),
    y: Math.round(rect.y - origin.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
};

// The Map's root and every element that stands for a state, parents first; the views beside it stay put.
const MOVERS = ':is(.nested:not(.vm-boxes), .map), [data-name]';

const moverKey = (element: HTMLElement): string => element.dataset.name ?? '';

// The key the Map's room is measured under, beside its movers; no state has a name with a space.
const ROOM = ' room';

// A change of type size is one object changing size: the diagram scales from its old outline and its boxes ride it.
const rescale = (
  root: HTMLElement,
  was: DOMRect,
  shift: { x: number; y: number },
): void => {
  const now = root.getBoundingClientRect();
  const from = `translate(${was.x + shift.x - now.x}px, ${was.y + shift.y - now.y}px) scale(${was.width / now.width}, ${was.height / now.height})`;

  root.animate(
    [
      { transformOrigin: '0 0', transform: from },
      { transformOrigin: '0 0', transform: 'none' },
    ],
    { id: RESCALE, duration: SETTLE, easing: EASE_OUT },
  );
};

// Whether two outlines have the same proportions, within a tenth.
const alike = (a: DOMRect, b: DOMRect): boolean =>
  Math.abs(Math.log((a.width * b.height) / (a.height * b.width || 1))) < 0.1;

// While a box changes size its header keeps its final width, so no name is elided mid-flight, and what the box does not hold yet stays out of sight.
const holdInside = (box: HTMLElement, rtl: boolean): (() => void) => {
  const head = box.querySelector<HTMLElement>(':scope > .head');
  const width = `${head?.offsetWidth ?? 0}px`;
  const timing = { id: FLIP, duration: SETTLE };

  // The clip leaves room for the selection outline, and at the inline start for the default-child marker.
  const clipPath = rtl
    ? 'inset(-4px -24px -4px -4px)'
    : 'inset(-4px -4px -4px -24px)';

  // The header is measured at rest, before the box's own animation narrows or widens it.
  return () => {
    head?.animate([{ minWidth: width }, { minWidth: width }], timing);
    box.animate([{ clipPath }, { clipPath }], timing);
  };
};

const sizeOf = (rect: DOMRect) => ({
  width: `${rect.width}px`,
  height: `${rect.height}px`,
});

// Only a box changes size: the root would re-centre mid-flight, and a tree node is its label.
const ease = (
  element: HTMLElement,
  was: DOMRect,
  now: DOMRect,
  { x, y, rtl }: { x: number; y: number; rtl: boolean },
): void => {
  const grows =
    element.matches('.box') &&
    (Math.abs(was.width - now.width) >= 1 ||
      Math.abs(was.height - now.height) >= 1);

  if (!grows && Math.abs(x) < 1 && Math.abs(y) < 1) return;

  const hold = grows ? holdInside(element, rtl) : undefined;
  const from: Keyframe = { transform: `translate(${x}px, ${y}px)` };
  const to: Keyframe = { transform: 'none' };

  if (grows) {
    Object.assign(from, sizeOf(was));
    Object.assign(to, sizeOf(now));
  }

  element.animate([from, to], {
    id: FLIP,
    duration: SETTLE,
    easing: EASE_OUT,
  });
  hold?.();
};

const elide = (name: string): string => {
  if (name.length <= 28) return name;

  return `…${name.split('.').slice(-2).join('.')}`;
};

// The element behind `<ui-router-devtools>`; `_` members are for the render modules beside it, never public.
export class DevtoolsPanel extends LitElement {
  static styles: CSSResultGroup = styles;

  static properties: PropertyDeclarations = {
    router: { attribute: false },
    history: { type: Number },
    timeResolves: { type: Boolean, attribute: 'time-resolves' },
    redaction: { attribute: false },
    viewLocator: { attribute: false },
    _live: { state: true },
    _imported: { state: true },
    _tab: { state: true },
    _view: { state: true },
    _layoutPref: { state: true },
    _mapViews: { state: true },
    _max: { state: true },
    _mapSize: { state: true },
    _mapOpen: { state: true },
    _mapFailed: { state: true },
    _mapPan: { state: true },
    _mapZoom: { state: true },
    _selectedTx: { state: true },
    _previewTx: { state: true },
    _selectedState: { state: true },
    _inspect: { state: true },
    _focusState: { state: true },
    _collapsed: { state: true },
    _announcement: { state: true },
    _copied: { state: true },
    _now: { state: true },
    _keepValues: { state: true },
    _keepMessages: { state: true },
    _notice: { state: true },
    _timelineFailed: { state: true },
    _timelineFocus: { state: true },
    _timelineSelected: { state: true },
    _timelineCollapsed: { state: true },
    _spanCount: { state: true },
    _viewsFailed: { state: true },
    _viewFocus: { state: true },
    _viewSelected: { state: true },
  };

  declare router: UIRouter | undefined;
  declare history: number;
  /** Time resolves by wrapping their `resolveFn`; read when the router attaches. */
  declare timeResolves: boolean;
  declare redaction: Redaction;
  /** Finds a view's element on the page, for the Views; a renderer's subpath supplies it. */
  declare viewLocator: ViewLocator | undefined;
  declare _live: Model;
  declare _imported: { session: Session; model: Model } | null;
  declare _tab: 'tree' | 'log';
  declare _view: StateView;
  declare _layoutPref: MapLayout;
  // The viewer's choice to draw the view map beside the nested Map where both fit.
  declare _mapViews: boolean;
  declare _max: boolean;
  declare _mapSize: Size;
  declare _mapOpen: ReadonlyMap<string, boolean>;
  // The Map's chunk failed to load; choosing the Map view again retries it.
  declare _mapFailed: boolean;
  // Where the Map was panned to, and the type step it was zoomed to; `null` is the fitted view.
  declare _mapPan: View | null;
  declare _mapZoom: number | null;
  declare _selectedTx: number | null;
  declare _previewTx: number | null;
  declare _selectedState: string | null;
  declare _inspect: Inspect;
  declare _focusState: string | null;
  /** The nested Map box the last first click landed on, for the double-click that click may start. */
  _pressed: string | null = null;
  declare _collapsed: ReadonlySet<string>;
  declare _announcement: string;
  // Which inspector copy button shows its check; it clears after a moment.
  declare _copied: string | null;
  declare _now: number;
  // Export's toggles, reset from `redaction` whenever it is set.
  declare _keepValues: boolean;
  declare _keepMessages: boolean;
  declare _notice: Notice | null;
  // The Timeline's chunk failed to load; choosing the Timeline again retries it.
  declare _timelineFailed: boolean;
  // The Timeline row with the roving tab stop, the one whose details show, and the rows closed by hand.
  declare _timelineFocus: string | null;
  declare _timelineSelected: string | null;
  declare _timelineCollapsed: ReadonlySet<string>;
  // Bumped by every span added, so the Timeline redraws.
  declare _spanCount: number;
  // The Views' chunk failed to load; choosing the Views again retries it.
  declare _viewsFailed: boolean;
  // The view with the roving tab stop, and the one whose details show, by the renderer's view id.
  declare _viewFocus: number | null;
  declare _viewSelected: number | null;

  _mapWidths: Map<string, number> = new Map();
  _moveFocus = false;
  _copiedTimer: ReturnType<typeof setTimeout> | undefined;
  // The validator loads on first import, so a panel that never imports does not pay for it; a spec swaps it to fail the load.
  _importReader = (): Promise<SessionReader> => import('../session-schema.ts');
  // Loads the Map's chunk; a spec swaps it to fail the load.
  _importMap = (): Promise<MapModule> => import('./map.ts');
  // Loads the Timeline's chunk; a spec swaps it to fail the load.
  _importTimeline = (): Promise<TimelineModule> => import('./timeline.ts');
  // The Timeline's waterfall and its render, loaded on first use of the Timeline view.
  _timeline: TimelineModule | undefined;
  #timelineLoading = false;
  // Loads the Views' chunk; a spec swaps it to fail the load.
  _importViews = (): Promise<ViewMapModule> => import('./viewmap.ts');
  _viewMap: ViewMapModule | undefined;
  #viewsLoading = false;
  // The view under the pointer, and the one the locator last marked on the page.
  #pointedView: number | null = null;
  #markedView: ViewInfo | null = null;
  readonly #adopted = new Set<CSSResult>();
  // Spans from a tracer, by span id, oldest first.
  #spans = new Map<string, SpanRecord>();
  // The Map's layouts and edge router, loaded on first use of the Map tab.
  _map: MapModule | undefined;
  #mapLoading = false;
  // What the Map last drew, and where its states were before a change to it.
  #geometry: readonly unknown[] = [];
  #before: Map<string, DOMRect> | null = null;
  // The tree that had focus before an update, which may remove the focused item.
  #focusTree: Element | null = null;
  // The layout last drawn, and whether the view was last moved by hand, which is not animated.
  #layout: NestedLayout | null = null;
  #direct = false;
  readonly #onWheel = {
    handleEvent: (event: WheelEvent) => this._map?.wheelPan(this, event),
    passive: false,
  };
  // The Map's type step, and whether the last change to the Map changed it.
  #step: Metrics | undefined;
  #resized = false;
  #resize: ResizeObserver | undefined;
  #observed: Element | null = null;
  #recorder: Recorder | undefined;
  #attached: UIRouter | undefined;
  #unsubscribe: (() => void) | undefined;
  #ticker: ReturnType<typeof setInterval> | undefined;
  // The scrubber and newest tick last scrolled to, so a render that adds no transition leaves the strip be.
  #newestTick: { ticks: Element; id: number | undefined } | undefined;
  // Where the last press on the Map began, so a click that ends a drag is told from one that does not.
  #press: { x: number; y: number } | undefined;

  constructor() {
    super();
    this.history = 500;
    this.timeResolves = false;
    this.redaction = defaultRedaction();
    this._live = emptyModel();
    this._imported = null;
    this._tab = 'tree';
    this._view = 'outline';
    this._layoutPref = storedLayout();
    this._mapViews = storedViews();
    this._max = false;
    this._mapSize = { width: 0, height: 0 };
    this._mapFailed = false;
    this._mapOpen = new Map();
    this._mapPan = null;
    this._mapZoom = null;
    this._inspect = 'none';
    this.#resetSelection();
    this._collapsed = new Set();
    this._announcement = '';
    this._copied = null;
    this._now = performance.now();
    this._notice = null;
    this._timelineFailed = false;
    this._timelineCollapsed = new Set();
    this._spanCount = 0;
    this._viewsFailed = false;
  }

  // The recorder behind the panel, for reporters that should share it.
  get recorder(): Recorder | undefined {
    return this.#recorder;
  }

  /** Spans from a tracer, for the Timeline; setting it replaces them all. */
  get spans(): readonly SpanRecord[] {
    return [...this.#spans.values()];
  }

  set spans(spans: readonly SpanRecord[]) {
    this.#spans = new Map();

    for (const span of spans) upsertSpan(this.#spans, span);
    this._spanCount += 1;
  }

  /** Adds a span, or replaces the one with its `spanId`, so a started span is sent again when it ends. */
  addSpan(span: SpanRecord): void {
    upsertSpan(this.#spans, span);
    this._spanCount += 1;
  }

  // The spans the Timeline joins: an imported session's own, else the ones given to the panel.
  _spanList(): readonly SpanRecord[] {
    return this._imported ? (this._imported.session.spans ?? []) : this.spans;
  }

  // The epoch time of the event clock's zero.
  get _timeOrigin(): number {
    return this._imported?.session.timeOrigin ?? performance.timeOrigin;
  }

  _timelineInput(): Omit<WaterfallInput, 'tx'> {
    const model = this._model;

    return {
      txs: model.txs,
      states: model.states,
      clock: this._clock,
      timeResolves: this._imported?.session.timeResolves ?? this.timeResolves,
      spans: this._spanList(),
      timeOrigin: this._timeOrigin,
    };
  }

  get _model(): Model {
    return this._imported?.model ?? this._live;
  }

  // An imported session's clock stops at its export, so a transition running then ends there.
  get _clock(): number {
    return this._imported?.session.t ?? this._now;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Firefox and WebKit keep the media rules a shared sheet matched while no adopter was connected; resetting its media re-evaluates them.
    for (const sheet of this.shadowRoot?.adoptedStyleSheets ?? [])
      sheet.media.mediaText = String(sheet.media);

    if (this.router && !this.#recorder) this.#attach(this.router);

    // Removal from the document closes every popover; a reconnected element shows its pill again.
    if (this.hasUpdated) this.#pill?.showPopover();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#mark(null);
    this.#detach();
    this.#resize?.disconnect();
    this.#observed = null;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('redaction')) {
      this._keepValues = this.redaction.params === 'all';
      this._keepMessages = this.redaction.messages;
    }

    if (changed.has('router') && this.#attached !== this.router) {
      this.#detach();
      this._live = emptyModel();
      this.#resetSelection();

      if (this.router && this.isConnected) this.#attach(this.router);
    }

    this.#forgetGoneViews();
    this.#dropStrandedView();
    this.#loadViews(changed);
    this.#followMap(changed);
    this.#syncTicker();
  }

  // Durations of a live transition tick while it runs, and on the Timeline so do the spans still running.
  #syncTicker() {
    const running =
      Boolean(this.#recorder) &&
      !this._imported &&
      (this._live.txs.some((tx) => !tx.result) ||
        (this._view === 'timeline' &&
          this.spans.some((span) => span.endTime === undefined)));

    if (running && !this.#ticker)
      this.#ticker = setInterval(() => (this._now = performance.now()), 100);

    if (!running && this.#ticker) {
      clearInterval(this.#ticker);
      this.#ticker = undefined;
    }
  }

  // The Map, the Timeline and the Views load on first use; a failed load retries when the view is chosen again.
  #loadViews(changed: PropertyValues<this>) {
    const retry = changed.has('_view');

    const due = (
      shown: boolean,
      loaded: boolean,
      loading: boolean,
      failed: boolean,
    ) => shown && !loaded && !loading && (!failed || retry);

    if (
      due(
        this._view === 'map',
        Boolean(this._map),
        this.#mapLoading,
        this._mapFailed,
      )
    )
      this.#loadMap();

    if (
      due(
        this._view === 'timeline',
        Boolean(this._timeline),
        this.#timelineLoading,
        this._timelineFailed,
      )
    )
      this.#loadTimeline();

    // The nested Map may draw the views beside it, so it loads them too.
    const views =
      this._view === 'views' ||
      (this._view === 'map' &&
        this._mapViews &&
        this._layoutPref === 'nested' &&
        this.#holdsViews());

    if (
      due(views, Boolean(this._viewMap), this.#viewsLoading, this._viewsFailed)
    )
      this.#loadViewMap();
  }

  #loadViewMap() {
    this.#viewsLoading = true;
    this._viewsFailed = false;

    if (this._announcement === VIEWS_FAILED) this._announcement = '';

    void this._importViews().then(
      (views) => {
        this._viewMap = views;
        this.#viewsLoading = false;
        this.#adopt(views.viewMapStyles);
        this.requestUpdate();
      },
      () => {
        this._viewsFailed = true;
        this.#viewsLoading = false;
        this._announcement = VIEWS_FAILED;
      },
    );
  }

  #loadMap() {
    this.#mapLoading = true;
    this._mapFailed = false;

    if (this._announcement === MAP_FAILED) this._announcement = '';

    void this._importMap().then(
      (map) => {
        this._map = map;
        this.#mapLoading = false;
        this.requestUpdate();
      },
      () => {
        this._mapFailed = true;
        this.#mapLoading = false;
        this._announcement = MAP_FAILED;
      },
    );
  }

  #loadTimeline() {
    this.#timelineLoading = true;
    this._timelineFailed = false;

    if (this._announcement === TIMELINE_FAILED) this._announcement = '';

    void this._importTimeline().then(
      (timeline) => {
        this._timeline = timeline;
        this.#timelineLoading = false;
        this.#adopt(timeline.timelineStyles);
        this.requestUpdate();
      },
      () => {
        this._timelineFailed = true;
        this.#timelineLoading = false;
        this._announcement = TIMELINE_FAILED;
      },
    );
  }

  // A chunk's own rules join the panel's and those of chunks loaded before it; lit falls back to style elements where sheets cannot be adopted.
  #adopt(styles: CSSResult) {
    this.#adopted.add(styles);
    // SAFETY: a LitElement renders into its open shadow root unless createRenderRoot is overridden, and this one's is not
    adoptStyles(this.renderRoot as ShadowRoot, [
      ...DevtoolsPanel.elementStyles,
      ...this.#adopted,
    ]);
  }

  // A panned view follows its layout: a zoom holds the middle of the room still, and a re-pack the focused box.
  #followMap(changed: PropertyValues<this>) {
    const nested = this._view === 'map' ? this._nested() : null;
    const last = this.#layout;
    const pan = this._mapPan;

    this.#layout = nested;

    if (!nested || !this._map) return;

    if (pan && last && last !== nested)
      this._mapPan = changed.has('_mapZoom')
        ? this._map.zoomView(
            pan,
            last.placed,
            nested.placed,
            this._room(nested),
          )
        : this.#anchored(pan, last, nested);

    // Focus moved by the keyboard or from the inspector brings its box into view.
    if (this._moveFocus && this._focusState)
      this._reveal(nested, this._focusState);
  }

  #anchored(pan: View, last: NestedLayout, nested: NestedLayout): View {
    const name = this._focusState ?? this._selectedState ?? '';
    const was = last.rects.get(name);
    const now = nested.rects.get(name);

    return was && now
      ? { x: pan.x + was.x - now.x, y: pan.y + was.y - now.y }
      : pan;
  }

  // A re-pack can move the focused box to another row, which rebuilds it; focus then returns to the same state.
  protected update(changed: PropertyValues<this>): void {
    const focused = this.shadowRoot?.activeElement;

    if (focused?.matches('.box > .head')) this._moveFocus = true;

    this.#focusTree = focused?.closest('[role="tree"]') ?? null;

    this.#before = this.#mapMoved() ? this.#measureMovers() : null;
    super.update(changed);
  }

  // The Map's drawing changes with its view, its layout and the panel's size; anything else leaves boxes where they are.
  #mapMoved(): boolean {
    const nested = this._view === 'map' ? this._nested() : null;
    const geometry = this.#drawnGeometry(nested);
    const direct = this.#direct;

    const moved =
      geometry.length !== this.#geometry.length ||
      geometry.some((part, index) => part !== this.#geometry[index]);

    const drawn = this.#geometry.length > 0;

    this.#direct = false;
    this.#geometry = geometry;
    this.#resized = Boolean(
      this.#step && nested && this.#step !== nested.metrics,
    );
    this.#step = nested?.metrics;

    return (
      moved &&
      drawn &&
      !direct &&
      geometry.length > 0 &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  #drawnGeometry(nested: NestedLayout | null): readonly unknown[] {
    if (this._view !== 'map') return [];

    const view = nested && this._viewOf(nested);

    return [nested?.placed ?? this._layoutPref, this._max, view?.x, view?.y];
  }

  get #movers(): HTMLElement[] {
    return [
      ...(this.renderRoot
        .querySelector('.map-scroll')
        ?.querySelectorAll<HTMLElement>(MOVERS) ?? []),
    ];
  }

  // Where each state is drawn now, mid-flight included, so an interrupted move starts from what the eye sees.
  #measureMovers(): Map<string, DOMRect> {
    const room = this.renderRoot.querySelector('.map-scroll');

    return new Map([
      ...this.#movers.map(
        (element) =>
          [moverKey(element), element.getBoundingClientRect()] as const,
      ),
      ...(room ? [[ROOM, room.getBoundingClientRect()] as const] : []),
    ]);
  }

  // How far the middle of the Map's room has moved on the page since `before` was read: the panel changes size at once, and the diagram is followed from where it sat in the room.
  #roomShift(before: ReadonlyMap<string, DOMRect>): { x: number; y: number } {
    const was = before.get(ROOM);

    const now = this.renderRoot
      .querySelector('.map-scroll')
      ?.getBoundingClientRect();

    return was && now
      ? {
          x: now.x + now.width / 2 - was.x - was.width / 2,
          y: now.y + now.height / 2 - was.y - was.height / 2,
        }
      : { x: 0, y: 0 };
  }

  // Ends the moves in flight and, when the type size changed, starts the one that scales the whole diagram.
  #rescaled(
    root: HTMLElement | undefined,
    outline: DOMRect | undefined,
    shift: { x: number; y: number },
  ) {
    // The panel's own resize re-packs once more while the diagram is still changing size; that stays one move.
    const rescaling =
      this.#resized ||
      root?.getAnimations().some((animation) => animation.id === RESCALE);

    for (const element of this.renderRoot.querySelectorAll('.map-scroll *'))
      for (const animation of element.getAnimations())
        if (animation.id === FLIP || animation.id === RESCALE)
          animation.cancel();

    if (!rescaling || !root?.matches('.nested') || !outline?.width)
      return false;

    // One object changing size keeps its proportions; a step that also rearranges the boxes moves them one by one.
    if (!alike(outline, root.getBoundingClientRect())) return false;

    rescale(root, outline, shift);

    return true;
  }

  // FLIP: each state's element starts where and as large as the state was and eases to its new place and size; a child moves relative to its parent.
  #flip(before: ReadonlyMap<string, DOMRect>) {
    const movers = this.#movers;
    const room = this.#roomShift(before);

    if (this.#rescaled(movers[0], before.get(''), room)) return;

    // A box hangs from its parent's inline-start edge, so that is the edge a shift is measured at.
    const rtl = getComputedStyle(this).direction === 'rtl';
    const edge = (rect: DOMRect) => (rtl ? rect.right : rect.x);
    const shifts = new Map<Element, { x: number; y: number }>();

    // Every box is read before any is animated, since a parent's animation would move what its children report.
    const plans = movers.map((element) => {
      const read = before.get(moverKey(element));
      const now = element.getBoundingClientRect();

      const was =
        read &&
        new DOMRect(read.x + room.x, read.y + room.y, read.width, read.height);

      const carried = shifts.get(
        element.parentElement?.closest(MOVERS) ?? element,
      ) ?? { x: 0, y: 0 };

      // A state that was not drawn rides with its parent and fades in.
      const shift = was
        ? { x: edge(was) - edge(now), y: was.y - now.y }
        : carried;

      shifts.set(element, shift);

      return {
        element,
        was: was ?? now,
        now,
        by: { x: shift.x - carried.x, y: shift.y - carried.y, rtl },
      };
    });

    for (const { element, was, now, by } of plans) ease(element, was, now, by);
  }

  protected firstUpdated(): void {
    if (this.isConnected) this.#pill?.showPopover();
  }

  protected updated(): void {
    this.#observeMap();
    this.#markPointed();

    if (this._view === 'views') this._viewMap?.measureViewMap(this);
    this.#measureMap();
    this.#placePopover();
    this.#showTick();

    if (this.#before) this.#flip(this.#before);
    this.#before = null;

    if (!this._moveFocus) return;
    this._moveFocus = false;

    // Beside the views the Map has two trees, and the arrow keys stay in the one that had focus.
    const tree = this.#focusTree?.isConnected
      ? this.#focusTree
      : this.renderRoot;

    tree.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]')?.focus();
  }

  // The nested Map packs for the Map viewport, and the Views for the area beside their details, so that content box is observed.
  #observeMap() {
    const scroller = this.renderRoot.querySelector('.map-scroll, .vm-main');

    if (scroller === this.#observed) return;

    this.#resize ??= new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      if (width !== this._mapSize.width || height !== this._mapSize.height)
        this._mapSize = { width, height };
    });
    this.#resize.disconnect();
    this.#observed = scroller;

    if (scroller) this.#resize.observe(scroller);
  }

  // The popover sits beside the selection, on the side that covers least of the drawn edges and the boxes they end at.
  #placePopover() {
    const panel = this.#panel;
    const popover = this.renderRoot.querySelector('.inspector-pane');

    if (!panel || !popover || this._view !== 'map' || this._max) return;

    const origin = panel.getBoundingClientRect();

    // A view is selected only beside the Map, whose split keeps the popover's column free.
    const place =
      this._inspect === 'view'
        ? this.#besidePlace(popover.getBoundingClientRect(), origin)
        : this.#anchoredPlace(popover, origin);

    if (!place) return;

    panel.style.setProperty('--uird-pop-x', `${place.x}px`);
    panel.style.setProperty('--uird-pop-y', `${place.y}px`);
  }

  #anchoredPlace(popover: Element, origin: DOMRect) {
    const root = this.renderRoot.querySelector<HTMLElement>('.nested');
    const nested = root && this._nested();

    const marked = [
      ...this.renderRoot.querySelectorAll('.map-node.anchor, .brand.anchor'),
    ].at(-1);

    // The diagram's place in the panel as drawn, its viewport's translation included.
    const drawn = root?.getBoundingClientRect();

    const at = drawn
      ? { x: drawn.x - origin.x, y: drawn.y - origin.y }
      : { x: 0, y: 0 };

    const inPanel = <R extends Rect>(rect: R): R => ({
      ...rect,
      x: rect.x + at.x,
      y: rect.y + at.y,
    });

    const box = nested && this._map?.anchorRect(this, nested);
    const anchor = box ? inPanel(box) : marked && rectOf(marked, origin);

    if (!anchor) return undefined;

    return this.#popoverPlace(
      anchor,
      popover.getBoundingClientRect(),
      origin,
      nested && box ? { nested, at } : undefined,
    );
  }

  // The popover's own column, at the end of the dock.
  #besidePlace(size: Size, origin: Size) {
    const rtl = getComputedStyle(this).direction === 'rtl';

    return { x: rtl ? MARGIN : origin.width - MARGIN - size.width, y: 38 };
  }

  // Beside the diagram the popover has a column of its own; over it, it takes the place that covers least.
  #popoverPlace(
    anchor: Rect,
    size: Size,
    origin: Size,
    map?: { nested: NestedLayout; at: { x: number; y: number } },
  ) {
    const bounds = {
      x: 8,
      y: 34,
      width: origin.width - 16,
      height: origin.height - 70,
    };

    if (!map) return placeBeside(anchor, size, bounds);

    if (this._beside(map.nested)) return this.#besidePlace(size, origin);

    const clear = this._map?.keepClear(this, map.nested) ?? [];

    return placeBeside(anchor, size, bounds, [
      { ...anchor, weight: 1000 },
      ...clear.map((rect) => ({
        ...rect,
        x: rect.x + map.at.x,
        y: rect.y + map.at.y,
      })),
    ]);
  }

  // The scrubber keeps the selected transition in view, else scrolls to a newest one that is new.
  #showTick() {
    const ticks = this.renderRoot.querySelector<HTMLElement>('.ticks');
    const tick = ticks?.querySelector<HTMLElement>('.tick.on');

    if (!ticks) return;

    if (!tick) {
      const id = this._model.txs.at(-1)?.id;
      const seen = this.#newestTick;

      // A hidden strip cannot scroll, so its newest tick stays unseen until it shows.
      if (!ticks.clientWidth || (seen?.ticks === ticks && seen.id === id))
        return;

      this.#newestTick = { ticks, id };
      ticks.scrollLeft =
        ticks.scrollWidth * (ticks.matches(':dir(rtl)') ? -1 : 1);

      return;
    }

    const box = ticks.getBoundingClientRect();
    const rect = tick.getBoundingClientRect();

    if (rect.left < box.left) ticks.scrollLeft -= box.left - rect.left;
    else if (rect.right > box.right) ticks.scrollLeft += rect.right - box.right;
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
    this._timelineFocus = null;
    this._timelineSelected = null;
    this._viewFocus = null;
    this._viewSelected = null;

    if (this._inspect !== 'router') this._inspect = 'none';
  }

  #attach(router: UIRouter) {
    this.#attached = router;

    const recorder = record(router, {
      limit: this.history * 40,
      timeResolves: this.timeResolves,
    });

    this.#recorder = recorder;
    this._live = fold(recorder.session({ params: 'all' }).events);
    this.#unsubscribe = recorder.subscribe((event) => {
      const next = apply(this._live, event);
      this._live =
        next.txs.length > this.history
          ? { ...next, txs: next.txs.slice(-this.history) }
          : next;

      if (event.type === 'result' || event.type === 'invalid')
        this.#announce(event.type === 'result' ? event.id : -event.seq);
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

  _duration(tx: Tx): number {
    return durationOf(this._model.txs, tx, this._clock);
  }

  #announce(id: number) {
    if (this._imported) return;
    const tx = this._live.txs.find((t) => t.id === id);
    const outcome = tx?.result?.outcome;

    if (!tx || !outcome || !['success', 'error', 'invalid'].includes(outcome))
      return;
    this._announcement =
      outcome === 'success'
        ? `Transition ${tx.id} succeeded: ${tx.to}, ${ms(this._duration(tx))}`
        : `${tx.id < 0 ? 'Target' : `Transition ${tx.id}`} failed: ${tx.to}. ${resultLine(tx)}`;
  }

  #open() {
    this.#pill?.hidePopover();
    this.#panel?.showPopover();
    this.#markPointed();
    void this.updateComplete.then(() =>
      this.renderRoot.querySelector<HTMLElement>('.close')?.focus(),
    );
  }

  #close() {
    this.#panel?.hidePopover();
    this.#markPointed();
    this.#pill?.showPopover();
    this.#pill?.focus();
  }

  // The Map holds one selection at a time, so a state or transition takes the place of a view selected beside it.
  #dropView() {
    if (this._inspect === 'view') this._viewSelected = null;
  }

  _selectTx(id: number | null): void {
    this.#dropView();
    this._selectedTx = id;
    this._inspect = id === null ? 'none' : 'tx';
  }

  // A click toggles; the second click of a double-click keeps the state selected.
  _selectState(name: string, keep = false): void {
    this.#dropView();
    this._selectedState = keep || this._selectedState !== name ? name : null;
    this._focusState = name;
    this._inspect = this._selectedState ? 'state' : 'none';
  }

  // The Go button and a double-click share this rule.
  _canGo(state: StateInfo): boolean {
    return (
      !this._imported &&
      !state.abstract &&
      // A lazy placeholder's params are its own, not those of the state it loads.
      (state.future || state.params.every((p) => p.optional)) &&
      !!this.router
    );
  }

  _go(state: StateInfo): void {
    if (this._canGo(state))
      void this.router?.stateService.go(bareName(state.name)).catch(() => {});
  }

  // The second press of a double-click would select the word under it; a drag still selects text.
  _keepText(event: MouseEvent): void {
    if (event.detail > 1) event.preventDefault();
  }

  // A double-click selects the state and goes to it when it can be gone to.
  _goState(name: string): void {
    const state = this._model.states.find((s) => s.name === name);

    this._selectState(name, true);

    if (state) this._go(state);
  }

  // Selects a state named in the inspector and moves focus to its row or box.
  _revealState(name: string): void {
    const hidden = new Set(ancestorsOf(this._model.states, name));

    this.#dropView();
    this._selectedState = name;
    this._focusState = name;
    this._inspect = 'state';
    this._collapsed = new Set(
      [...this._collapsed].filter((state) => !hidden.has(state)),
    );
    this._mapOpen = new Map(
      [...this._mapOpen].filter(([state]) => !hidden.has(state)),
    );
    this._moveFocus = true;
  }

  _selectView(id: number | null): void {
    const map = this._view === 'map';

    const again =
      id === this._viewSelected && (!map || this._inspect === 'view');

    this._viewSelected = again ? null : id;

    if (id !== null) this._viewFocus = id;

    if (!map) return;

    // Beside the Map a view is shown in the panel's inspector, in place of a state or transition.
    this._selectedState = null;
    this._selectedTx = null;
    this._inspect = this._viewSelected === null ? 'none' : 'view';
  }

  _pointView(id: number | null): void {
    this.#pointedView = id;
    this.#markPointed();
  }

  // Selects a state named in a view's details: on the Map beside the views, else in the Outline.
  _showState(name: string): void {
    if (this._view !== 'map') this._view = 'outline';
    this._revealState(name);
  }

  // The locator marks the view under the pointer, else the selected one, while views of the live router are drawn.
  #markPointed() {
    const tab = this._view === 'views';
    const beside = this._view === 'map' && Boolean(this._mapLayout()?.split);

    const shown =
      (tab || beside) &&
      !this._imported &&
      Boolean(this.#panel?.matches(':popover-open'));

    const chosen = tab || this._inspect === 'view' ? this._viewSelected : null;
    const id = shown ? (this.#pointedView ?? chosen) : null;
    const view = this.#viewOf(id);

    // A new snapshot is a new object, so the mark follows a view that changed or left.
    if (view !== this.#markedView) this.#mark(view);
  }

  #viewOf(id: number | null): ViewInfo | null {
    return this._model.views?.views.find((view) => view.id === id) ?? null;
  }

  #mark(view: ViewInfo | null) {
    this.#markedView = view;
    this.viewLocator?.highlight(view);
  }

  // A view that left the snapshot is no longer selected or pointed at.
  #forgetGoneViews() {
    if (this.#viewOf(this._viewSelected) === null) {
      this._viewSelected = null;

      if (this._inspect === 'view') this._inspect = 'none';
    }

    if (this.#viewOf(this.#pointedView) === null) this.#pointedView = null;
  }

  // A view is inspected only beside the Map; once the split goes, so do the inspection and the page's outline.
  #dropStrandedView() {
    if (this._inspect !== 'view') return;

    if (this._view === 'map' && this._mapLayout()?.split) return;

    // The Views tab keeps its selection for its own details.
    if (this._view !== 'views') this._viewSelected = null;
    this._inspect = 'none';
  }

  // The states tied to the view selected beside the Map, and how: the one whose content created it, and the one that fills it.
  _linkedStates(): ReadonlyMap<string, string> {
    const view = this._inspect === 'view' && this.#viewOf(this._viewSelected);

    if (!view) return new Map();

    const ties: [string, string][] = [
      [view.context, 'created the selected view'],
      [view.fill?.state ?? '', 'fills the selected view'],
    ];

    return new Map(ties.filter(([name]) => name));
  }

  _clearSelection(): void {
    this.#dropView();
    this._selectedState = null;
    this._selectedTx = null;
    this._inspect = 'none';
  }

  // Clears the selection; focus inside the inspector, which then hides, goes back to where the selection was made.
  _dismiss(): void {
    const from = this.#selectionSources();

    const held = this.shadowRoot?.activeElement?.closest(
      '.inspector-pane, .router-pane',
    );

    this._clearSelection();

    if (!held) return;

    void this.updateComplete.then(() =>
      from
        .find((element) => element?.isConnected && element.checkVisibility())
        ?.focus(),
    );
  }

  // Where the current selection was made, most specific first, then the Map or Outline's tab stop.
  #selectionSources(): (HTMLElement | null)[] {
    const find = (selector: string) =>
      this.renderRoot.querySelector<HTMLElement>(selector);

    const tx = this._inspect === 'tx';

    return [
      this._inspect === 'router' ? find('.brand') : null,
      tx ? find('.ticks') : null,
      tx ? find('.log .tx.selected > .line') : null,
      this._inspect === 'state' ? find('.map-node.selected') : null,
      this._inspect === 'view' ? find('.vm-side .box.selected > .head') : null,
      find('[role="treeitem"][tabindex="0"]'),
      find('.map-node'),
      // The narrowest panel shows only its tabs.
      find('.tabs [aria-selected="true"]'),
    ];
  }

  // Escape anywhere in the panel clears a selection, once whatever had focus has passed it up.
  #onKey(event: KeyboardEvent) {
    // SAFETY: the listener is on the panel, whose event targets are its own elements
    const target = event.target as Element;

    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      this._inspect === 'none' ||
      target.closest('input, textarea, select, [contenteditable]')
    )
      return;

    event.preventDefault();
    this._dismiss();
  }

  // A click on the Map's empty room clears the selection; one on anything drawn, or that ends a drag, does not.
  #onMapClick(event: MouseEvent) {
    const press = this.#press;
    // SAFETY: the listener is on the Map viewport, whose event targets are its own elements
    const target = event.target as Element;

    this.#press = undefined;

    if (
      this._inspect === 'none' ||
      !target.matches('.map-scroll, .nested, .map') ||
      (press &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >= DRAG)
    )
      return;

    this._dismiss();
  }

  // The state the inspector popover sits beside: the selected state, or a selected transition's target.
  get _anchorState(): string | null {
    if (this._inspect === 'state') return this._selectedState;

    return this._inspect === 'tx'
      ? (this._tx(this._selectedTx)?.to ?? null)
      : null;
  }

  // Whether the dock has room for the inspector popover beside the diagram. It follows the diagram's size, never the selection.
  _beside(nested: NestedLayout): boolean {
    return !this._max && this._mapSize.width - nested.placed.width >= ASIDE;
  }

  // The room kept at the diagram's end so the popover's column is empty before anything is selected, and nothing moves when it is.
  _reserve(nested: NestedLayout): number {
    // Beside the views, the column is kept at the end of theirs.
    if (!this._beside(nested) || this._mapLayout()?.split) return 0;

    const spare = this._mapSize.width - nested.placed.width;

    // Centred while a column is free either side; past that the diagram gives up its end margin first.
    return Math.max(0, Math.min(ASIDE, ASIDE * 2 - spare));
  }

  // The room the Map is shown in, for the view of a layout: the state side's, when the views are drawn beside it.
  _room(nested: NestedLayout): Room {
    return {
      ...(this._mapLayout()?.split?.states ?? this._mapSize),
      reserve: this._reserve(nested),
      // A dock without the column has the popover over the diagram, which can then be pulled out from under it.
      slack: this._max || this._beside(nested) ? 0 : ASIDE,
      foot: this._map?.MINI_FOOT ?? 0,
      rtl: nested.rtl,
    };
  }

  // Where the diagram sits: where it was panned to, else fitted, and when it overflows with the current state in the middle.
  _viewOf(nested: NestedLayout): View {
    const map = this._map;
    const room = this._room(nested);
    const size = nested.placed;

    if (!map) return { x: 0, y: 0 };

    if (this._mapPan) return map.clampView(this._mapPan, size, room);

    const current = nested.rects.get(this._model.current.name);

    return current && map.overflows(size, room)
      ? map.centreView(current, size, room)
      : map.fitView(size, room);
  }

  _pans(nested: NestedLayout): boolean {
    return Boolean(this._map?.overflows(nested.placed, this._mapSize));
  }

  // Moves the view and says whether it moved; a drag or the wheel moves it at once, anything else eases.
  _panTo(nested: NestedLayout, view: View, eased: boolean): boolean {
    const now = this._viewOf(nested);

    const next =
      this._map?.clampView(view, nested.placed, this._room(nested)) ?? now;

    if (next.x === now.x && next.y === now.y) return false;

    this.#direct = !eased;
    this._mapPan = next;

    return true;
  }

  _reveal(nested: NestedLayout, name: string): void {
    const rect = nested.rects.get(name);

    if (!rect || !this._map) return;

    const view = this._map.revealView(
      this._viewOf(nested),
      rect,
      nested.placed,
      this._room(nested),
    );

    this._panTo(nested, view, true);
  }

  _zoomBy(nested: NestedLayout, steps: number): void {
    const last = (this._map?.ZOOMS.length ?? 1) - 1;
    const step = Math.min(last, Math.max(0, nested.step + steps));

    if (step !== nested.step) this._mapZoom = step;
  }

  _fit(): void {
    this._mapPan = null;
    this._mapZoom = null;
  }

  _depthClass(name: string): string {
    return depthClass(ancestorsOf(this._model.states, name).length + 1);
  }

  // What colour says: a state's identity, except while a transition is in focus, when it says what that transition does.
  get #mode(): 'tx' | 'state' | 'rest' {
    if (this._focusTx) return 'tx';

    return this._inspect === 'state' ? 'state' : 'rest';
  }

  // The nested layout, when it is loaded, chosen and offered at this width.
  _nested(): NestedLayout | null {
    return this._mapLayout()?.nested ?? null;
  }

  // The nested layout and, where the view map fits beside it in the dock or the maximised panel, the split's rooms.
  _mapLayout(): { nested: NestedLayout; split: Split | null } | null {
    if (
      !this._map ||
      this._view !== 'map' ||
      this._layoutPref !== 'nested' ||
      this._mapSize.width < NESTED_MIN_WIDTH
    )
      return null;

    const whole = this._map.layoutNested(this);

    const split =
      this._mapViews && this._viewMap && matchMedia(WIDE).matches
        ? this._viewMap.splitOf(this, whole, this._max ? 0 : ASIDE)
        : null;

    return {
      nested: split ? this._map.layoutNested(this, split.states) : whole,
      split,
    };
  }

  #chooseLayout(layout: MapLayout) {
    this._layoutPref = layout;
    storeLayout(layout);
  }

  #chooseViews(shown: boolean) {
    this._mapViews = shown;
    storeViews(shown);
  }

  // Session export and import

  session(redaction?: Partial<Redaction>): Session | undefined {
    const session = this._imported?.session ?? this.#liveSession();

    return (
      session &&
      redactSession(session, redactionOf({ ...this.redaction, ...redaction }))
    );
  }

  // The recorder's session, with the spans that ran during its transitions when the panel was given any.
  #liveSession(): Session | undefined {
    const session = this.#recorder?.session({ params: 'all' });

    if (!session || !this.#spans.size) return session;

    const spans = spansDuring(
      this.spans,
      fold(session.events).txs,
      session.timeOrigin,
      session.t,
    );

    return spans.length ? { ...session, spans } : session;
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

  // What the session holds beyond the folded model: its event count and what it lost.
  _sessionFacts(): SessionFacts {
    const imported = this._imported?.session;

    if (imported)
      return {
        routerId: imported.routerId,
        events: imported.events.filter((event) => !SNAPSHOTS.has(event.type))
          .length,
        dropped: imported.dropped,
      };

    const recorder = this.#recorder;

    return {
      routerId: recorder?.routerId ?? '',
      events: recorder?.events.length ?? 0,
      dropped: recorder?.dropped ?? 0,
    };
  }

  #goLive() {
    this._imported = null;
    this._notice = null;
    this.#resetSelection();
    this._announcement = 'Showing the live router.';
  }

  // The toggle decides both ways; off falls back to the configured allowlist, or to none when that is 'all'.
  _exportSession(): Session | undefined {
    const configured = this.redaction.params;

    return this.session({
      params: this._keepValues ? 'all' : configured === 'all' ? [] : configured,
      messages: this._keepMessages,
    });
  }

  #export() {
    const session = this._exportSession();

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

  #fail(text: string) {
    this._notice = { text, fault: true };
    this._announcement = text;
  }

  async #readFile(file: File | undefined) {
    if (!file) return;
    this._notice = null;

    let json: unknown;

    try {
      json = JSON.parse(await file.text());
    } catch {
      this.#fail(`Import failed: ${file.name} is not JSON.`);

      return;
    }

    let reader: SessionReader;

    try {
      reader = await this._importReader();
    } catch {
      this.#fail('Import failed: the session reader did not load. Try again.');

      return;
    }

    const read = reader.readSession(json);

    if (!read.ok) {
      this.#fail(`Import failed: ${read.error}`);

      return;
    }

    this.importSession(read.session);

    const skipped = [
      ...(read.skipped
        ? [
            `${read.skipped} ${read.skipped === 1 ? 'event' : 'events'} of a kind this version does not read`,
          ]
        : []),
      ...(read.skippedSpans
        ? [
            `${read.skippedSpans} ${read.skippedSpans === 1 ? 'span' : 'spans'} that did not read`,
          ]
        : []),
    ];

    if (skipped.length)
      this._notice = { text: `${skipped.join(' and ')} skipped`, fault: false };
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
        data-mode=${this.#mode}
        ?data-max=${this._max}
        ?data-imported=${imported}
        @dragover=${(e: DragEvent) => e.preventDefault()}
        @drop=${this.#onDrop}
        @keydown=${this.#onKey}
      >
        ${this.#renderTitle()}
        <div class="body">
          <section
            class="pane tree-pane"
            id="pane-tree"
            role="tabpanel"
            aria-labelledby="h-states"
          >
            ${this.#sectionHead('1', HEADINGS[this._view], 'h-states')}
            <div class="pane-switch">${this.#renderSwitch()}</div>
            ${this.#renderStates()}
          </section>
          ${this._view === 'outline' ? nothing : renderScrubber(this)}
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
            ${this.#sectionHead('3', 'Inspector', 'h-insp', inspected ? seq(inspected.id) || 'Invalid target' : this.#inspectorAside())}${
              this._inspect === 'none'
                ? nothing
                : html`<button
                    class="icon dismiss"
                    aria-label="Close inspector"
                    title="Close (Esc)"
                    @click=${() => this._dismiss()}
                  >
                    ${closeGlyph}
                  </button>`
            }
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

  #renderStates() {
    if (this._view === 'outline')
      return html`<div class="scroll outline-scroll">
        ${renderOutline(this)}
      </div>`;

    if (this._view === 'timeline')
      return html`<div class="scroll timeline-scroll">
        ${
          this._timeline
            ? this._timeline.renderTimeline(this)
            : this._timelineFailed
              ? html`<p class="empty">${TIMELINE_FAILED}</p>`
              : nothing
        }
      </div>`;

    if (this._view === 'views')
      return html`<div class="scroll views-scroll">
        ${
          this._viewMap
            ? this._viewMap.renderViewMap(this)
            : this._viewsFailed
              ? html`<p class="empty">${VIEWS_FAILED}</p>`
              : nothing
        }
      </div>`;

    const layout = this._mapLayout();
    const split = layout?.split;
    const map = this._map;

    /* oxlint-disable lit-a11y/click-events-have-key-events -- Escape anywhere in the panel clears the selection too */
    return html`<div
      class="scroll map-scroll"
      ?data-pan=${layout && this._pans(layout.nested)}
      ?data-split=${Boolean(split)}
      style=${split ? `--uird-split:${split.states.width}px` : nothing}
      @pointerdown=${(event: PointerEvent) => {
        this.#press = { x: event.clientX, y: event.clientY };
        map?.startPan(this, event);
      }}
      @click=${this.#onMapClick}
      @wheel=${this.#onWheel}
    >
      ${map ? this.#renderMap(map, layout) : this.#mapNotice()}
    </div>`;
    /* oxlint-enable lit-a11y/click-events-have-key-events */
  }

  #renderMap(map: MapModule, layout: ReturnType<typeof this._mapLayout>) {
    if (!layout) return map.renderMap(this);

    const states = map.renderNested(this, layout.nested);

    // SAFETY: a split is only weighed once the views' module has loaded
    return layout.split
      ? this._viewMap!.renderSplit(this, layout.split, states)
      : states;
  }

  #mapNotice() {
    return this._mapFailed ? html`<p class="empty">${MAP_FAILED}</p>` : nothing;
  }

  // Outline or Map, and on the Map the nested boxes or the node-link tree.
  #renderSwitch() {
    const map = this._view === 'map';
    const layout = this._nested();
    const nested = Boolean(layout);
    const narrow = this._mapSize.width < NESTED_MIN_WIDTH;
    const why = `Nested boxes need ${NESTED_MIN_WIDTH}px of width`;

    return html`<div class="switch" role="group" aria-label="State view">
        ${(['outline', 'map', 'timeline', 'views'] as const).map(
          (view) =>
            html`<button
              aria-pressed=${this._view === view}
              @click=${() => (this._view = view)}
            >
              ${view}
            </button>`,
        )}
      </div>
      ${
        map
          ? html`<div class="switch" role="group" aria-label="Map layout">
                <button
                  aria-pressed=${nested}
                  ?disabled=${narrow}
                  title=${narrow ? why : 'Child states inside their parent'}
                  @click=${() => this.#chooseLayout('nested')}
                >
                  Nested
                </button>
                <button
                  aria-pressed=${!nested}
                  title="Node-link tree"
                  @click=${() => this.#chooseLayout('tree')}
                >
                  Tree
                </button>
              </div>
              ${layout ? this.#renderViewTools(layout) : nothing}
              ${layout && this.#holdsViews() && matchMedia(WIDE).matches ? this.#renderViewsToggle(layout) : nothing}`
          : nothing
      }`;
  }

  // Draws the view map beside the nested Map where both fit; the viewer's choice is kept, and pressed means drawn.
  #renderViewsToggle(layout: NestedLayout) {
    const drawn = Boolean(this._mapLayout()?.split);
    const away = this._mapViews && !drawn;

    return html`<div class="switch" role="group" aria-label="Beside the Map">
      <button
        aria-pressed=${drawn}
        ?disabled=${away}
        title=${away ? (this.#viewsAway(layout) ?? nothing) : 'The view map beside the states, where both fit'}
        @click=${() => this.#chooseViews(!this._mapViews)}
      >
        View map
      </button>
    </div>`;
  }

  // Whether the session's views snapshot holds any view; an empty one is no snapshot to the split.
  #holdsViews(): boolean {
    return Boolean(this._model.views?.views.length);
  }

  // Why the views the viewer asked for are not drawn beside the Map; nothing while their module is still loading.
  #viewsAway(layout: NestedLayout): string | undefined {
    if (!this._viewMap) return this._viewsFailed ? VIEWS_FAILED : undefined;

    if (this._mapZoom !== null)
      return 'The view map is drawn at the fitted size; Fit brings it back';

    return layout.rung === 'pan'
      ? 'The view map is not drawn while the states pan'
      : 'No room for the view map beside the states';
  }

  // The view of the Map: its type step, and the way back to the fitted view.
  #renderViewTools(layout: NestedLayout) {
    const last = (this._map?.ZOOMS.length ?? 1) - 1;
    const fitted = this._mapPan === null && this._mapZoom === null;

    return html`<div
      class="switch view-tools"
      role="group"
      aria-label="Map view"
    >
      <button
        class="step"
        aria-label="Zoom out"
        title="Smaller type (−)"
        ?disabled=${layout.step <= 0}
        @click=${() => this._zoomBy(layout, -1)}
      >
        −
      </button>
      <button
        class="step"
        aria-label="Zoom in"
        title="Larger type (+)"
        ?disabled=${layout.step >= last}
        @click=${() => this._zoomBy(layout, 1)}
      >
        +
      </button>
      <button
        title="Fit the map to the panel (0)"
        ?disabled=${fitted}
        @click=${() => this._fit()}
      >
        Fit
      </button>
    </div>`;
  }

  #inspectorAside(): string | undefined {
    if (this._inspect === 'state') return undefined;

    if (this._inspect === 'view') return 'View';

    return this._inspect === 'none' || this._inspect === 'router'
      ? 'Router'
      : undefined;
  }

  #renderInspector(inspected: Tx | undefined) {
    if (inspected) return renderTxInspector(this, inspected);

    if (this._inspect === 'state') return renderStateInspector(this);

    // SAFETY: a view is selected beside the Map only, which the views' module draws
    if (this._inspect === 'view')
      return this._viewMap!.renderViewInspector(this);

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

    const name =
      running?.to ??
      (last && last.result?.outcome !== 'success'
        ? last.to
        : this._model.current.name);

    return {
      status,
      name: name || '(root)',
      took: tx && tx.id >= 0 ? took(this._duration(tx)) : nothing,
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
      >${took === nothing ? nothing : html`<span class="num">${took}</span>`}${
        this._imported ? html`<span class="tag">Imported</span>` : nothing
      }
    </button>`;
  }

  #toggleRouter() {
    this.#dropView();
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

  // What Export keeps; each toggle starts from `redaction`.
  _exportToggles(): TemplateResult {
    return html`<div class="switch" role="group" aria-label="Export keeps">
      <button
        aria-pressed=${this._keepValues}
        title=${this._keepValues ? 'Export keeps param values' : 'Export redacts param values; keys stay'}
        @click=${() => (this._keepValues = !this._keepValues)}
      >
        Param values
      </button>
      <button
        aria-pressed=${this._keepMessages}
        title=${this._keepMessages ? 'Export keeps error messages' : 'Export drops error messages'}
        @click=${() => (this._keepMessages = !this._keepMessages)}
      >
        Messages
      </button>
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
        class="brand ${this._inspect === 'router' || this._inspect === 'tx' ? 'anchor' : ''}"
        aria-pressed=${this._inspect === 'router'}
        title="Router configuration"
        @click=${this.#toggleRouter}
      >
        Router
      </button>
      <div class="strip-switch">${this.#renderSwitch()}</div>
      ${this.#renderTabs()}
      ${imported ? html`<span class="imported tag" title=${imported.session.routerId}>Imported</span>` : nothing}
      <span class="spacer"
        >${
          this._notice
            ? html`<span
                class="notice ${this._notice.fault ? 'fault' : ''}"
                title=${this._notice.text}
                >${this._notice.text}</span
              >`
            : nothing
        }</span
      >
      <span class="counts">
        ${counts.map(
          ([status, n, label]) =>
            html`<span
              class="count status-${status} ${n ? '' : 'zero'}"
              title="${n} ${label}"
              >${statusGlyph(status)}<span class="num">${n}</span
              ><span class="visually-hidden">${label}</span></span
            >`,
        )}
      </span>
      <span class="session">${this._sessionButtons()}</span>
      <button
        class="icon max"
        aria-pressed=${this._max}
        aria-label="Maximise devtools"
        title=${this._max ? 'Restore the dock' : 'Maximise'}
        @click=${() => {
          this._max = !this._max;
          this._fit();
        }}
      >
        ${this._max ? minGlyph : maxGlyph}
      </button>
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
