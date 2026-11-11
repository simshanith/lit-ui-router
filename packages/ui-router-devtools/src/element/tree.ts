import { html, nothing, svg, type TemplateResult } from 'lit';
import { hierarchy, tree } from 'd3-hierarchy';
import type { Row, UIRouterDevtools } from '../ui-router-devtools.ts';
import type { StateInfo } from '../schema.ts';
import { segment } from '../notation.ts';
import { pivotGlyph, roleGlyph, roleLabel, type Role } from './glyphs.ts';

const INDENT = 24;

const GLYPH_R = 5;

const MAP_ROW = 36;

const MAP_LEAD = 12;

const MAP_RUN = 36;

const CHAR = 6.7;

const RANK: Record<Role, number> = {
  inactive: 0,
  future: 0,
  retained: 1,
  ancestor: 2,
  current: 2,
  exiting: 3,
  entering: 4,
  errored: 5,
};

const rowHeight = () => (matchMedia('(pointer: coarse)').matches ? 32 : 24);

const rails = (paths: { role: Role; d: string }[]) =>
  paths.map(
    ({ role, d }) =>
      svg`${role === 'exiting' ? svg`<path class="knockout" d=${d} />` : nothing}<path class="rail role-${role}" d=${d} />`,
  );

const renderRails = (host: UIRouterDevtools, rows: Row[]) => {
  const h = rowHeight();
  const index = new Map(rows.map((r, i) => [r.state.name, i]));
  const gx = (depth: number) => 12 + (depth - 1) * INDENT + 6;

  const segments = rows
    .flatMap((row, i) => {
      if (row.depth <= 1) return [];

      const pi = index.get(row.state.parent ?? '') ?? 0;
      const px = gx(row.depth - 1);

      return [
        {
          role: host._role(row.state),
          d: `M${px} ${pi * h + h / 2 + GLYPH_R}V${i * h + h / 2}H${gx(row.depth) - GLYPH_R}`,
        },
      ];
    })
    .sort((a, b) => RANK[a.role] - RANK[b.role]);

  return html`<svg
    class="rails"
    aria-hidden="true"
    width=${gx(Math.max(1, ...rows.map((r) => r.depth))) + 8}
    height=${rows.length * h}
  >
    ${rails(segments)}
  </svg>`;
};

const MIRRORED: ReadonlyMap<string, string> = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

// Left and right arrows follow the reading direction.
const logicalKey = (host: HTMLElement, key: string): string =>
  getComputedStyle(host).direction === 'rtl' ? (MIRRORED.get(key) ?? key) : key;

const onTreeKey = (
  host: UIRouterDevtools,
  event: KeyboardEvent,
  rows: Row[],
  focus: string | undefined,
) => {
  const i = rows.findIndex((r) => r.state.name === focus);
  const row = rows[i];

  if (!row) return;

  const go = (target: Row | undefined) => {
    if (!target) return;
    host._focusState = target.state.name;
    host._moveFocus = true;
  };

  const toggle = (name: string, collapse: boolean) => {
    const next = new Set(host._collapsed);

    if (collapse) next.add(name);
    else next.delete(name);
    host._collapsed = next;
  };

  const expanded = row.hasChildren && !host._collapsed.has(row.state.name);

  switch (logicalKey(host, event.key)) {
    case 'ArrowDown':
      go(rows[i + 1]);
      break;
    case 'ArrowUp':
      go(rows[i - 1]);
      break;
    case 'Home':
      go(rows[0]);
      break;
    case 'End':
      go(rows.at(-1));
      break;
    case 'ArrowRight':
      if (row.hasChildren && !expanded) toggle(row.state.name, false);
      else if (expanded) go(rows[i + 1]);
      break;
    case 'ArrowLeft':
      if (expanded) toggle(row.state.name, true);
      else go(rows.find((r) => r.state.name === row.state.parent));
      break;
    case 'Enter':
    case ' ':
      host._selectState(row.state.name);
      break;
    default:
      return;
  }

  event.preventDefault();
};

const label = (state: StateInfo, pivot: string | undefined, title: boolean) =>
  html`<span class="name">${segment(state.name)}</span>${
      state.name === pivot
        ? html`<span
            class="pivot"
            title=${title ? 'pivot: deepest retained state' : nothing}
            >${pivotGlyph}</span
          >`
        : nothing
    }${state.future ? html`<span class="tag">Lazy</span>` : nothing}`;

export const renderOutline = (host: UIRouterDevtools): TemplateResult => {
  const rows = host._rows();
  const pivot = host._focusTx?.retained.at(-1);
  const current = host._model.current.name;

  const focus =
    host._focusState && rows.some((r) => r.state.name === host._focusState)
      ? host._focusState
      : (rows.find((r) => r.state.name === current) ?? rows[0])?.state.name;

  return html`<div
    class="outline"
    role="tree"
    aria-labelledby="h-states"
    @keydown=${(e: KeyboardEvent) => onTreeKey(host, e, rows, focus)}
  >
    ${renderRails(host, rows)}
    ${rows.map((row) => {
      const { state } = row;
      const role = host._role(state);
      const selected = host._selectedState === state.name;

      /* oxlint-disable lit-a11y/click-events-have-key-events, lit-a11y/role-supports-aria-attr -- the tree's keydown handler moves focus and selects for every treeitem; aria-description is a global attribute in ARIA 1.3 */
      return html`<div
        role="treeitem"
        class="row role-${role} ${selected ? 'selected' : ''}"
        tabindex=${state.name === focus ? 0 : -1}
        aria-level=${row.depth}
        aria-setsize=${row.setsize}
        aria-posinset=${row.posinset}
        aria-expanded=${row.hasChildren ? (host._collapsed.has(state.name) ? 'false' : 'true') : nothing}
        aria-current=${role === 'current' ? 'true' : nothing}
        aria-selected=${selected}
        aria-description=${roleLabel[role]}
        style="--depth:${row.depth}"
        @click=${() => host._selectState(state.name)}
        @focus=${() => (host._focusState = state.name)}
      >
        ${roleGlyph(role)}${label(state, pivot, true)}
      </div>`;
      /* oxlint-enable lit-a11y/click-events-have-key-events, lit-a11y/role-supports-aria-attr */
    })}
  </div>`;
};

type MapNode = { state: StateInfo | null; children: MapNode[] };

export const renderMap = (
  host: UIRouterDevtools,
): TemplateResult | typeof nothing => {
  if (host._view !== 'map') return nothing;
  const children = host._children();

  const build = (parent: string | null): MapNode[] =>
    (children.get(parent) ?? []).map((state) => ({
      state,
      children: build(state.name),
    }));

  const layout = tree<MapNode>()
    .nodeSize([MAP_ROW, 1])
    .separation(() => 1)(
    hierarchy<MapNode>({ state: null, children: build(null) }),
  );

  const nodes = layout.descendants();
  const pivot = host._focusTx?.retained.at(-1);

  const nodeWidth = (state: StateInfo) =>
    host._mapWidths.get(state.name) ??
    12 + 12 + segment(state.name).length * CHAR;

  // Column n starts one edge run past the widest label in column n - 1.
  const columns = [6];
  const depths = Math.max(...nodes.map((n) => n.depth));

  for (let depth = 1; depth <= depths; depth++) {
    const widest = Math.max(
      0,
      ...nodes
        .filter((n) => n.depth === depth - 1 && n.data.state)
        .map((n) => nodeWidth(n.data.state!) - 6 + MAP_LEAD),
    );

    columns.push(columns[depth - 1] + widest + MAP_RUN);
  }

  const top = Math.min(...nodes.map((n) => n.x));

  const pos = (n: (typeof nodes)[number]) => ({
    x: columns[n.depth],
    y: n.x - top + 12,
  });

  const width = Math.max(
    ...nodes.map(
      (n) => pos(n).x + (n.data.state ? nodeWidth(n.data.state) : 0),
    ),
  );

  const height = Math.max(...nodes.map((n) => pos(n).y)) + 12;

  const links = layout
    .links()
    .map(({ source, target }) => {
      const s = pos(source);
      const t = pos(target);

      const sx = source.data.state
        ? s.x - 6 + nodeWidth(source.data.state) + MAP_LEAD
        : s.x + 4;

      const role: Role = target.data.state
        ? host._role(target.data.state)
        : 'inactive';

      return { role, d: `M${sx} ${s.y}H${t.x - 24}V${t.y}H${t.x - GLYPH_R}` };
    })
    .sort((a, b) => RANK[a.role] - RANK[b.role]);

  return html`<div
    class="map"
    role="group"
    aria-label="State map"
    style="width:${width}px;height:${height}px"
  >
    <svg class="edges" aria-hidden="true" width=${width} height=${height}>
      ${rails(links)}
    </svg>
    ${nodes.map((node) => {
      const { x, y } = pos(node);
      const state = node.data.state;

      if (!state)
        return html`<span
          class="map-root"
          style="inset-inline-start:${x - 4}px;top:${y - 4}px"
          aria-hidden="true"
        ></span>`;
      const role = host._role(state);
      const selected = host._selectedState === state.name;

      return html`<button
        class="map-node role-${role} ${selected ? 'selected' : ''}"
        data-name=${state.name}
        style="inset-inline-start:${x - 6}px;top:${y - 12}px"
        aria-pressed=${selected}
        aria-label="${state.name}, ${roleLabel[role]}"
        @click=${() => host._selectState(state.name)}
      >
        ${roleGlyph(role)}${label(state, pivot, false)}
      </button>`;
    })}
  </div>`;
};
