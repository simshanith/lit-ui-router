import { html, type TemplateResult } from 'lit';
import { hierarchy, tree } from 'd3-hierarchy';
import type { UIRouterDevtools } from '../ui-router-devtools.ts';
import type { StateInfo } from '../schema.ts';
import { segment } from '../notation.ts';
import { depthClass, stateMarks, type Role } from './glyphs.ts';
import { facts, GLYPH_R, label, rails, RANK, words } from './tree.ts';

const MAP_ROW = 36;

const MAP_LEAD = 12;

const MAP_RUN = 36;

const CHAR = 6.7;

type MapNode = { state: StateInfo | null; children: MapNode[] };

export const renderMap = (host: UIRouterDevtools): TemplateResult => {
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
  const current = host._model.current.name;

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

      return {
        role,
        depth: target.depth,
        d: `M${sx} ${s.y}H${t.x - 24}V${t.y}H${t.x - GLYPH_R}`,
      };
    })
    .sort((a, b) => RANK[a.role] - RANK[b.role]);

  return html`<div
    class="map"
    role="group"
    aria-label="State map"
    style="inline-size:${width}px;block-size:${height}px"
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
          style="inset-inline-start:${x - 4}px;inset-block-start:${y - 4}px"
          aria-hidden="true"
        ></span>`;
      const role = host._role(state);
      const isPivot = role === 'retained' && state.name === pivot;
      const marks = stateMarks(state, host._model.states);
      const selected = host._selectedState === state.name;

      return html`<button
        class="map-node role-${role} ${depthClass(node.depth)} ${facts(state, current)} ${selected ? 'selected' : ''} ${state.name === host._anchorState ? 'anchor' : ''}"
        data-name=${state.name}
        style="inset-inline-start:${x - 6}px;inset-block-start:${y - 12}px"
        aria-pressed=${selected}
        aria-label="${state.name}, ${words(state, role, isPivot, marks)}"
        @click=${() => host._selectState(state.name)}
      >
        ${label(state, role, isPivot, marks, segment(state.name), false)}
      </button>`;
    })}
  </div>`;
};
