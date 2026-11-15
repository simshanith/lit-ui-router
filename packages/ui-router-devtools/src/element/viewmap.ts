// The Views' code, loaded on first use of the Views view so a panel that never shows it does not pay for it.
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { DevtoolsPanel } from './panel.ts';
import type { ViewFill, ViewInfo } from '../schema.ts';
import { ancestorsOf } from '../fold.ts';
import { truncateMiddle } from '../notation.ts';
import { targetText, viewTree, type ViewNode } from '../views.ts';
import { textWidth } from './measure.ts';
import {
  drawnIn,
  METRICS,
  pack,
  type Box,
  type Drawn,
  type Metrics,
  type Placed,
} from './pack.ts';
import { fitView, type View } from './viewport.ts';

export { viewMapStyles } from './viewmap-styles.ts';

/** The Map's dock step, with room for a view's name and the state that fills it in one header. */
const VIEW_METRICS: Metrics = { ...METRICS, max: 320 };

const LONG = 28;

export interface ViewRow {
  node: ViewNode;
  setsize: number;
  posinset: number;
}

/** Views in tree order, for the arrow keys and the item numbering. */
export const viewRows = (nodes: readonly ViewNode[]): ViewRow[] =>
  nodes.flatMap((node, index) => [
    { node, setsize: nodes.length, posinset: index + 1 },
    ...viewRows(node.children),
  ]);

// A name that repeats in the tree, `$default` above all, is told apart by its path.
const repeatedNames = (views: readonly ViewInfo[]): Set<string> => {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const { name } of views) (seen.has(name) ? repeated : seen).add(name);

  return repeated;
};

interface Scene {
  host: DevtoolsPanel;
  repeated: ReadonlySet<string>;
  /** The states on the active path, and the root. */
  active: ReadonlySet<string>;
  focus: number | undefined;
  rows: ReadonlyMap<number, ViewRow>;
}

const viewName = (view: ViewInfo, scene: Pick<Scene, 'repeated'>): string =>
  scene.repeated.has(view.name) ? view.fqn : view.name;

const stateText = (state: string): string =>
  state ? truncateMiddle(state, LONG) : '(root)';

// A sticky state stays filling its views after it is left; such a fill is not on the active path.
const inactive = (fill: ViewFill | null, scene: Pick<Scene, 'active'>) =>
  Boolean(fill && !scene.active.has(fill.state));

/** What a view's item says: its name, what fills it, and whether that is on the active path. */
export const describeView = (
  view: ViewInfo,
  scene: Pick<Scene, 'repeated' | 'active'>,
): string => {
  const name = `${viewName(view, scene)} view`;

  if (!view.fill) return `${name}, empty`;

  return `${name}, filled by ${view.fill.state || 'the root'}${inactive(view.fill, scene) ? ', inactive' : ''}`;
};

interface Fonts {
  /** The face names are set in. */
  mono: string;
  /** The face the panel's own tags are set in. */
  sans: string;
}

// A tag is set in uppercase caption type tracked 0.08em.
const tagWidth = (text: string, { sans }: Fonts): number =>
  textWidth(text.toUpperCase(), `400 11px ${sans}`) + text.length * 0.88;

const labelWidth = (
  view: ViewInfo,
  scene: Pick<Scene, 'repeated' | 'active'>,
  fonts: Fonts,
): number => {
  const font = `400 ${VIEW_METRICS.type}px ${fonts.mono}`;

  const parts = [
    textWidth(viewName(view, scene), font),
    view.fill
      ? textWidth(stateText(view.fill.state), font)
      : tagWidth('Empty', fonts),
    ...(inactive(view.fill, scene) ? [tagWidth('Inactive', fonts)] : []),
  ];

  // Padding either side, and a gap between each part and the next.
  return Math.ceil(
    16 + 8 * (parts.length - 1) + parts.reduce((a, b) => a + b, 0),
  );
};

const boxOf = (
  node: ViewNode,
  scene: Pick<Scene, 'repeated' | 'active'>,
  fonts: Fonts,
): Box => ({
  name: String(node.view.id),
  label: labelWidth(node.view, scene, fonts),
  children: node.children.map((child) => boxOf(child, scene, fonts)),
});

const MIRRORED: ReadonlyMap<string, string> = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

// Up and down move in tree order, right into a view's first nested view and left to the view around it, as in the Outline.
const target = (
  key: string,
  rows: readonly ViewRow[],
  index: number,
): ViewRow | undefined => {
  const row = rows[index];

  switch (key) {
    case 'ArrowDown':
      return rows[index + 1];
    case 'ArrowUp':
      return rows[index - 1];
    case 'Home':
      return rows[0];
    case 'End':
      return rows.at(-1);
    case 'ArrowRight':
      return row?.node.children.length ? rows[index + 1] : undefined;
    default:
      return rows.find((each) => each.node.view.id === row?.node.parent);
  }
};

const MOVES = new Set([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'ArrowRight',
  'ArrowLeft',
]);

const onKey = (
  host: DevtoolsPanel,
  event: KeyboardEvent,
  rows: readonly ViewRow[],
  focus: number | undefined,
) => {
  const index = rows.findIndex((row) => row.node.view.id === focus);
  const rtl = getComputedStyle(host).direction === 'rtl';
  const key = (rtl && MIRRORED.get(event.key)) || event.key;

  if (key === 'Enter' || key === ' ') {
    if (focus !== undefined) host._selectView(focus);
  } else if (key === 'Escape' && host._viewSelected !== null)
    host._selectView(null);
  else if (MOVES.has(key)) {
    const next = target(key, rows, index);

    if (next) {
      host._viewFocus = next.node.view.id;
      host._moveFocus = true;
    }
  } else return;

  event.preventDefault();
};

const renderFill = (view: ViewInfo, scene: Scene) => {
  const { fill } = view;

  if (!fill) return html`<span class="tag">Empty</span>`;

  return html`<span
      class="name vm-fill ${scene.host._depthClass(fill.state)}"
      title=${fill.state || '(root)'}
      >${stateText(fill.state)}</span
    >${inactive(fill, scene) ? html`<span class="tag">Inactive</span>` : nothing}`;
};

/* oxlint-disable lit-a11y/click-events-have-key-events -- the tree's keydown handler moves focus and selects for every treeitem */
const renderHead = (scene: Scene, node: ViewNode) => {
  const { host } = scene;
  const { view } = node;
  const row = scene.rows.get(view.id);
  const compound = node.children.length > 0;

  return html`<div
    class="head"
    role="treeitem"
    title=${view.fqn}
    tabindex=${view.id === scene.focus ? 0 : -1}
    aria-label=${describeView(view, scene)}
    aria-level=${node.depth}
    aria-setsize=${row?.setsize ?? 1}
    aria-posinset=${row?.posinset ?? 1}
    aria-owns=${compound ? `vm-kids-${view.id}` : nothing}
    aria-expanded=${compound ? 'true' : nothing}
    aria-selected=${host._viewSelected === view.id}
    @click=${() => host._selectView(view.id)}
    @focus=${() => (host._viewFocus = view.id)}
    @pointerenter=${() => host._pointView(view.id)}
    @pointerleave=${() => host._pointView(null)}
  >
    <span class="name">${viewName(view, scene)}</span>${renderFill(view, scene)}
  </div>`;
};
/* oxlint-enable lit-a11y/click-events-have-key-events */

const boxClasses = (scene: Scene, view: ViewInfo, compound: boolean) =>
  [
    'box',
    compound ? 'open' : 'leaf',
    view.fill ? scene.host._depthClass(view.fill.state) : 'vacant',
    inactive(view.fill, scene) && 'inactive',
    scene.host._viewSelected === view.id && 'selected',
  ]
    .filter(Boolean)
    .join(' ');

const renderBoxes = (
  scene: Scene,
  placed: Placed,
  nodes: ReadonlyMap<string, ViewNode>,
) =>
  repeat(
    drawnIn(placed, VIEW_METRICS),
    (item) => item.box.name,
    (item) => renderBox(scene, item, nodes),
  );

const renderBox = (
  scene: Scene,
  item: Drawn,
  nodes: ReadonlyMap<string, ViewNode>,
): TemplateResult => {
  const node = nodes.get(item.box.name)!;
  const compound = node.children.length > 0;

  return html`<div
    role="none"
    class=${boxClasses(scene, node.view, compound)}
    data-view=${node.view.id}
    style="inset-inline-start:${item.x}px;inset-block-start:${item.y}px;inline-size:${item.width}px;block-size:${item.height}px"
  >
    ${renderHead(scene, node)}${
      compound
        ? html`<div class="kids" role="group" id="vm-kids-${node.view.id}">
            ${renderBoxes(scene, item.placed, nodes)}
          </div>`
        : nothing
    }
  </div>`;
};

// A state named in the details; it opens the Outline with that state selected.
const stateLink = (host: DevtoolsPanel, name: string) =>
  name
    ? html`<button
        class="link ${host._depthClass(name)}"
        title=${name}
        @click=${() => host._showState(name)}
      >
        ${name}
      </button>`
    : '(root)';

type Fact = readonly [term: string, value: unknown];

const facts = (host: DevtoolsPanel, view: ViewInfo): Fact[] => {
  const { fill } = view;
  // An imported session's page is not the recorded one, so it has no place to report.
  const place = host._imported ? undefined : host.viewLocator?.describe?.(view);

  return [
    ['Path', view.fqn],
    ['Type', view.type],
    ['Created in', stateLink(host, view.context)],
    ['Filled by', fill ? stateLink(host, fill.state) : 'nothing; empty'],
    ...(fill
      ? ([
          ['Declared', `views.${fill.view}`],
          ['Targets', targetText(fill)],
          ...(fill.component ? [['Component', fill.component] as const] : []),
        ] as const)
      : []),
    ...(place === undefined
      ? []
      : ([['On page', place ?? 'not found']] as const)),
  ];
};

const renderDetail = (host: DevtoolsPanel, view: ViewInfo | undefined) => {
  if (!view) return nothing;

  return html`<section
    class="vm-detail"
    tabindex="0"
    aria-labelledby="h-vm-detail"
  >
    <h3 class="insp-title" id="h-vm-detail">
      <span class="name">${view.name}</span>
    </h3>
    <dl class="facts">
      ${facts(host, view).map(
        ([term, value]) =>
          html`<dt>${term}</dt>
            <dd>${value}</dd>`,
      )}
    </dl>
  </section>`;
};

// Configs no view took: their content is declared active and is nowhere on the page.
const renderUnmatched = (host: DevtoolsPanel, unmatched: readonly ViewFill[]) =>
  unmatched.length
    ? html`<section class="vm-unmatched" aria-labelledby="h-vm-unmatched">
        <h3 class="section sub" id="h-vm-unmatched">
          <span class="title">No view took</span>
        </h3>
        <ul class="plain">
          ${unmatched.map(
            (fill) =>
              html`<li>
                ${stateLink(host, fill.state)}<span class="muted">
                  views.${fill.view} → ${targetText(fill)}</span
                >
              </li>`,
          )}
        </ul>
      </section>`
    : nothing;

const activeStates = (host: DevtoolsPanel): Set<string> => {
  const { states, current } = host._model;

  return new Set(['', current.name, ...ancestorsOf(states, current.name)]);
};

/** The details column, which stands beside the boxes once the Views are this wide; `viewmap-styles.ts` sets both. */
const DETAIL = 296;

const BESIDE = 720;

// Below the drawing in the same room: the configs no view took.
const footOf = (host: DevtoolsPanel): number => feet.get(host) ?? 0;

const feet = new WeakMap<DevtoolsPanel, number>();

/** Measures what sits under the drawing, and draws again once when it changed, so the drawing centres in the room above it. */
export const measureViewMap = (host: DevtoolsPanel): void => {
  const list = host.renderRoot.querySelector<HTMLElement>('.vm-unmatched');

  const foot = list ? Math.ceil(list.getBoundingClientRect().height) : 0;

  if (foot === footOf(host)) return;
  feet.set(host, foot);
  host.requestUpdate();
};

interface Layout {
  placed: Placed;
  view: View;
}

/**
 * Packs the views for the room they are drawn in and places them as the Map's fitted view does: in the middle on an
 * axis they fit, at the start of one they overflow. Before a view is selected the details' column is kept free where
 * the dock has room for it, so selecting one moves nothing.
 */
const layoutOf = (
  host: DevtoolsPanel,
  roots: readonly ViewNode[],
  scene: Pick<Scene, 'repeated' | 'active'>,
  selected: boolean,
): Layout => {
  const style = getComputedStyle(host);

  const fonts = {
    mono: style.getPropertyValue('--uird-font-mono'),
    sans: style.getPropertyValue('--uird-font'),
  };

  const margin = parseFloat(style.getPropertyValue('--uird-margin')) || 0;
  const { width } = host._mapSize;
  const reserve = !selected && width + margin * 2 >= BESIDE ? DETAIL : 0;
  const height = Math.max(0, host._mapSize.height - footOf(host));

  const placed = pack(
    roots.map((root) => boxOf(root, scene, fonts)),
    { width: width - reserve, height },
    VIEW_METRICS,
  );

  // Margins are logical, so the view is taken as left to right and mirrors with the page.
  const view = fitView(placed, {
    width,
    height,
    reserve,
    slack: 0,
    foot: 0,
    rtl: false,
  });

  return { placed, view };
};

/** The router's `ui-view`s as nested boxes, each named with what fills it, and the selected view's details. */
export const renderViewMap = (host: DevtoolsPanel): TemplateResult => {
  const snapshot = host._model.views;

  if (!snapshot) return html`<p class="empty">This session holds no views.</p>`;

  const roots = viewTree(snapshot.views);
  const rows = viewRows(roots);

  const scene: Scene = {
    host,
    repeated: repeatedNames(snapshot.views),
    active: activeStates(host),
    focus:
      rows.find((row) => row.node.view.id === host._viewFocus)?.node.view.id ??
      rows[0]?.node.view.id,
    rows: new Map(rows.map((row) => [row.node.view.id, row])),
  };

  const selected = snapshot.views.find(
    (view) => view.id === host._viewSelected,
  );

  const nodes = new Map(
    rows.map((row) => [String(row.node.view.id), row.node]),
  );

  const layout = rows.length
    ? layoutOf(host, roots, scene, Boolean(selected))
    : undefined;

  const placed = layout?.placed;

  return html`<div class="viewmap" ?data-detail=${Boolean(selected)}>
    <div class="vm-main">
      ${
        placed && layout
          ? html`<div
              class="nested vm-boxes"
              role="tree"
              aria-labelledby="h-states"
              style="inline-size:${placed.width}px;block-size:${placed.height}px;margin-inline-start:${layout.view.x}px;margin-block-start:${layout.view.y}px"
              @keydown=${(event: KeyboardEvent) => onKey(host, event, rows, scene.focus)}
            >
              ${
                placed.box
                  ? renderBox(
                      scene,
                      {
                        box: placed.box,
                        placed,
                        x: 0,
                        y: 0,
                        width: placed.width,
                        height: placed.height,
                      },
                      nodes,
                    )
                  : renderBoxes(scene, placed, nodes)
              }
            </div>`
          : html`<p class="empty">No ui-view is registered with the router.</p>`
      }
      ${renderUnmatched(host, snapshot.unmatched)}
    </div>
    ${renderDetail(host, selected)}
  </div>`;
};
