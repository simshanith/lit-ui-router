import { html, nothing, svg, type TemplateResult } from 'lit';
import type { Row, DevtoolsPanel } from './panel.ts';
import type { StateInfo } from '../schema.ts';
import { segment } from '../notation.ts';
import { bareName } from '../fold.ts';
import {
  depthClass,
  describeState,
  markGlyph,
  markLabel,
  pivotGlyph,
  pivotLabel,
  plainPivotGlyph,
  roleGlyph,
  roleLabel,
  stateMarks,
  type Role,
  type StateMark,
} from './glyphs.ts';

const INDENT = 24;

export const GLYPH_R = 5;

export const RANK: Record<Role, number> = {
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

export interface Segment {
  role: Role;
  /** The depth of the state the rail leads into; the rail takes that state's identity colour. */
  depth: number;
  d: string;
  // The rail into a default child starts at a dot and ends in an arrowhead.
  initial?: string;
}

export const rails = (paths: Segment[]): TemplateResult[] =>
  paths.map(
    ({ role, depth, d }) =>
      svg`${role === 'exiting' ? svg`<path class="knockout" d=${d} />` : nothing}<path class="rail role-${role} ${depthClass(depth)}" d=${d} />`,
  );

const initials = (paths: Segment[]) =>
  paths.map(({ role, depth, initial }) =>
    initial
      ? svg`<path class="rail-initial role-${role} ${depthClass(depth)}" d=${initial} />`
      : nothing,
  );

const renderRails = (host: DevtoolsPanel, rows: Row[]) => {
  const h = rowHeight();
  const index = new Map(rows.map((r, i) => [r.state.name, i]));
  const gx = (depth: number) => 12 + (depth - 1) * INDENT + 6;

  const segments = rows
    .flatMap((row, i): Segment[] => {
      if (row.depth <= 1) return [];

      const pi = index.get(row.state.parent ?? '') ?? 0;
      const px = gx(row.depth - 1);
      const y = i * h + h / 2;
      const end = gx(row.depth) - GLYPH_R;

      return [
        {
          role: host._role(row.state),
          depth: row.depth,
          d: `M${px} ${pi * h + h / 2 + GLYPH_R}V${y}H${end}`,
          initial:
            rows[pi]?.state.redirectTo === bareName(row.state.name)
              ? `M${px - 3} ${y}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0zM${end - 5} ${y - 3.5}L${end} ${y}L${end - 5} ${y + 3.5}z`
              : undefined,
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
    ${rails(segments)}${initials(segments)}
  </svg>`;
};

const MIRRORED: ReadonlyMap<string, string> = new Map([
  ['ArrowLeft', 'ArrowRight'],
  ['ArrowRight', 'ArrowLeft'],
]);

// Left and right arrows follow the reading direction.
const logicalKey = (host: HTMLElement, key: string): string =>
  getComputedStyle(host).direction === 'rtl' ? (MIRRORED.get(key) ?? key) : key;

export interface TreeKeys {
  expanded: (row: Row) => boolean;
  toggle: (name: string, collapse: boolean) => void;
}

const outlineKeys = (host: DevtoolsPanel): TreeKeys => ({
  expanded: (row) => row.hasChildren && !host._collapsed.has(row.state.name),
  toggle: (name, collapse) => {
    const next = new Set(host._collapsed);

    if (collapse) next.add(name);
    else next.delete(name);
    host._collapsed = next;
  },
});

// Arrow keys move in tree order; the Outline and the nested Map share them.
export const onTreeKey = (
  host: DevtoolsPanel,
  event: KeyboardEvent,
  rows: Row[],
  focus: string | undefined,
  { expanded: isExpanded, toggle }: TreeKeys = outlineKeys(host),
): void => {
  const i = rows.findIndex((r) => r.state.name === focus);
  const row = rows[i];

  if (!row) return;

  const go = (target: Row | undefined) => {
    if (!target) return;
    host._focusState = target.state.name;
    host._moveFocus = true;
  };

  const expanded = isExpanded(row);

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

const glyphOf = (
  state: StateInfo,
  role: Role,
  pivot: boolean,
  titled: boolean,
) => {
  if (pivot) return titled ? pivotGlyph : plainPivotGlyph;

  return roleGlyph(role, state.abstract, titled);
};

// The row's slots: a 12px glyph, the name, then the trailing marks and tag. Weight and slant follow facts, never the previewed role.
export const label = (
  state: StateInfo,
  role: Role,
  pivot: boolean,
  marks: readonly StateMark[],
  name: string = segment(state.name),
  titled = true,
): TemplateResult =>
  html`${glyphOf(state, role, pivot, titled)}<span class="name">${name}</span>${
      marks.length
        ? html`<span class="marks" aria-hidden="true"
            >${marks.map(
              (mark) =>
                html`<span class="mark" title=${markLabel(mark)}
                  >${markGlyph(mark.mark)}</span
                >`,
            )}</span
          >`
        : nothing
    }${state.future ? html`<span class="tag">Lazy</span>` : nothing}`;

export const facts = (state: StateInfo, current: string): string =>
  `${state.name === current ? 'current' : ''} ${state.future ? 'future' : ''}`;

export const words = (
  state: StateInfo,
  role: Role,
  pivot: boolean,
  marks: readonly StateMark[],
): string => describeState(pivot ? pivotLabel : roleLabel[role], state, marks);

export const renderOutline = (
  host: DevtoolsPanel,
): TemplateResult | typeof nothing => {
  if (host._view !== 'outline') return nothing;

  const rows = host._rows();
  const pivot = host._focusTx?.retained.at(-1);
  const { states } = host._model;
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
      const isPivot = role === 'retained' && state.name === pivot;
      const marks = stateMarks(state, states);
      const selected = host._selectedState === state.name;

      /* oxlint-disable lit-a11y/click-events-have-key-events, lit-a11y/role-supports-aria-attr -- the tree's keydown handler moves focus and selects for every treeitem; aria-description is a global attribute in ARIA 1.3 */
      return html`<div
        role="treeitem"
        class="row role-${role} ${depthClass(row.depth)} ${facts(state, current)} ${selected ? 'selected' : ''}"
        tabindex=${state.name === focus ? 0 : -1}
        aria-level=${row.depth}
        aria-setsize=${row.setsize}
        aria-posinset=${row.posinset}
        aria-expanded=${row.hasChildren ? (host._collapsed.has(state.name) ? 'false' : 'true') : nothing}
        aria-current=${state.name === current ? 'true' : nothing}
        aria-selected=${selected}
        aria-description=${words(state, role, isPivot, marks)}
        style="--depth:${row.depth}"
        @click=${() => host._selectState(state.name)}
        @focus=${() => (host._focusState = state.name)}
      >
        ${label(state, role, isPivot, marks)}
      </div>`;
      /* oxlint-enable lit-a11y/click-events-have-key-events, lit-a11y/role-supports-aria-attr */
    })}
  </div>`;
};
