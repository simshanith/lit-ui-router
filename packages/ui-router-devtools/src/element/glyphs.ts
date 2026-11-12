import { svg, type SVGTemplateResult } from 'lit';
import type { Status } from '../notation.ts';
import type { StateInfo } from '../schema.ts';

export type { Status };

export type Role =
  | 'current'
  | 'ancestor'
  | 'inactive'
  | 'future'
  | 'entering'
  | 'exiting'
  | 'retained'
  | 'errored';

const frame = (body: SVGTemplateResult, cls: string): SVGTemplateResult =>
  svg`<svg class="glyph ${cls}" viewBox="0 0 12 12" aria-hidden="true">${body}</svg>`;

const ring = svg`<circle class="ring" cx="6" cy="6" r="4.75" />`;

const fault = svg`<rect class="fault" x="1" y="1" width="10" height="10" /><path class="knock" d="M3.75 3.75l4.5 4.5M8.25 3.75l-4.5 4.5" />`;

// An abstract state is never a target itself, so its outline is the statechart's compound-state box.
const box = svg`<title>abstract</title><rect class="ring" x="1.25" y="1.25" width="9.5" height="9.5" rx="1" />`;

const roleBodies = (
  outline: SVGTemplateResult,
): Record<Role, SVGTemplateResult> => ({
  current: svg`<circle class="solid" cx="6" cy="6" r="5.5" />`,
  ancestor: svg`${outline}<circle class="solid" cx="6" cy="6" r="2" />`,
  inactive: outline,
  future: svg`<circle class="ring" cx="6" cy="6" r="4.75" stroke-dasharray="2.487" />`,
  entering: svg`${outline}<path class="sign" d="M6 3v6M3 6h6" />`,
  exiting: svg`${outline}<path class="sign" d="M3 6h6" />`,
  retained: svg`${outline}<path d="M3.5 4.5h5M3.5 7.5h5" />`,
  errored: fault,
});

const concreteBodies = roleBodies(ring);

const abstractBodies = roleBodies(box);

export type Mark = 'initial' | 'history' | 'sticky';

const markBodies: Record<Mark, SVGTemplateResult> = {
  initial: svg`<circle class="solid" cx="2.5" cy="6" r="2" /><path d="M4.5 6h5.5" /><polyline points="7.5,3.5 10,6 7.5,8.5" />`,
  history: svg`${ring}<path d="M4.25 3.5v5M7.75 3.5v5M4.25 6h3.5" />`,
  sticky: svg`<rect x="0.75" y="2.25" width="10.5" height="7.5" rx="1" /><path d="M6 3.75v4.5" stroke-dasharray="1.5" />`,
};

const statusBodies: Record<Status, SVGTemplateResult> = {
  running: svg`<path class="arc" d="M6 1.5a4.5 4.5 0 1 1 -4.5 4.5" />`,
  success: svg`<polyline points="2.5,6.5 5,9 9.5,3.5" />`,
  error: fault,
  invalid: svg`<polygon class="fault" points="6,0.75 11.5,11 0.5,11" /><path class="knock" d="M6 4.5v4" />`,
  redirected: svg`<polyline points="2.5,2.5 2.5,7 9,7" /><polyline points="7,5 9,7 7,9" />`,
  superseded: svg`<polyline points="2.5,3 5.5,6 2.5,9" /><polyline points="6.5,3 9.5,6 6.5,9" />`,
  aborted: svg`${ring}<path d="M2.8 9.2L9.2 2.8" />`,
  ignored: svg`<path d="M3.5 6h5" />`,
};

export const roleGlyph = (role: Role, abstract = false): SVGTemplateResult =>
  frame((abstract ? abstractBodies : concreteBodies)[role], `role-${role}`);

export const markGlyph = (mark: Mark): SVGTemplateResult =>
  frame(markBodies[mark], `mark-${mark}`);

export const statusGlyph = (status: Status): SVGTemplateResult =>
  frame(statusBodies[status], `status-${status}`);

// The deepest retained state; it takes the role glyph's place, so nothing in the row moves when it appears.
export const pivotGlyph: SVGTemplateResult = frame(
  svg`<title>pivot: deepest retained state</title><polygon class="solid" points="6,0.5 11.5,6 6,11.5 0.5,6" />`,
  'pivot',
);

export const pivotLabel = 'retained, pivot';

export const closeGlyph: SVGTemplateResult = frame(
  svg`<path d="M3 3l6 6M9 3l-6 6" />`,
  'close',
);

export const roleLabel: Record<Role, string> = {
  current: 'active, current',
  ancestor: 'active',
  inactive: 'inactive',
  future: 'lazy, not loaded',
  entering: 'entering',
  exiting: 'exiting',
  retained: 'retained',
  errored: 'errored',
};

export interface StateMark {
  mark: Mark;
  term: string;
  text: string;
}

// What a state's declaration says beyond its place in the tree; a redirect to a direct child is its default child.
export const stateMarks = (
  state: StateInfo,
  states: readonly StateInfo[],
): StateMark[] => {
  const marks: StateMark[] = [];

  if (state.redirects) {
    const target = states.find((s) => s.name === state.redirectTo);

    marks.push({
      mark: 'initial',
      term: target?.parent === state.name ? 'Default child' : 'Redirects to',
      text: state.redirectTo ?? 'a target computed when it runs',
    });
  }

  if (state.dsr)
    marks.push({
      mark: 'history',
      term: 'History',
      text: state.dsr.default
        ? `deep state redirect, default ${state.dsr.default}`
        : 'deep state redirect',
    });

  if (state.sticky)
    marks.push({
      mark: 'sticky',
      term: 'Sticky',
      text: 'kept alive while a sibling is active',
    });

  return marks;
};

export const markLabel = ({ term, text }: StateMark): string =>
  `${term.toLowerCase()}: ${text}`;

// The words a treeitem or map node carries after its name.
export const describeState = (
  role: string,
  state: StateInfo,
  marks: readonly StateMark[],
): string =>
  [role, state.abstract && 'abstract', ...marks.map(markLabel)]
    .filter(Boolean)
    .join(', ');

export const statusLabel: Record<Status, string> = {
  running: 'running',
  success: 'succeeded',
  error: 'failed',
  invalid: 'invalid target',
  redirected: 'redirected',
  superseded: 'superseded',
  aborted: 'aborted',
  ignored: 'ignored',
};
