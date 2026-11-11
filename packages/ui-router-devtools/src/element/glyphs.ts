import { svg, type SVGTemplateResult } from 'lit';
import type { Status } from '../notation.ts';

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

const roleBodies: Record<Role, SVGTemplateResult> = {
  current: svg`<circle class="solid" cx="6" cy="6" r="5.5" />`,
  ancestor: svg`${ring}<circle class="solid" cx="6" cy="6" r="2" />`,
  inactive: ring,
  future: svg`<circle class="ring" cx="6" cy="6" r="4.75" stroke-dasharray="2.487" />`,
  entering: svg`${ring}<path class="sign" d="M6 3v6M3 6h6" />`,
  exiting: svg`${ring}<path class="sign" d="M3 6h6" />`,
  retained: svg`${ring}<path d="M3.5 4.5h5M3.5 7.5h5" />`,
  errored: fault,
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

export const roleGlyph = (role: Role): SVGTemplateResult =>
  frame(roleBodies[role], `role-${role}`);

export const statusGlyph = (status: Status): SVGTemplateResult =>
  frame(statusBodies[status], `status-${status}`);

export const pivotGlyph: SVGTemplateResult = frame(
  svg`<polygon class="solid" points="6,1.5 10.5,6 6,10.5 1.5,6" />`,
  'pivot',
);

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
