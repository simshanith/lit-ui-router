import type { LitElement } from 'lit';
import type { UIRouter } from '@uirouter/core';

import { DevtoolsPanel } from './element/panel.ts';
import type { Recorder } from './recorder.ts';
import type { Redaction, Session } from './schema.ts';

/** `<ui-router-devtools>`: a pill that opens a panel of the router's states, transitions and config. */
export interface UIRouterDevtools extends LitElement {
  /** The router to record. */
  router: UIRouter | undefined;
  /** How many transitions the log keeps; the attribute is `history`. */
  history: number;
  /** Time resolves by wrapping their `resolveFn`; read when the router attaches. The attribute is `time-resolves`. */
  timeResolves: boolean;
  /** What Export scrubs unless the panel's toggles say otherwise: param keys without their values and messages kept by default. */
  redaction: Redaction;
  /** The recorder behind the panel, for reporters that should share it. */
  readonly recorder: Recorder | undefined;
  /** The session the panel shows, live or imported, scrubbed by `redaction`, which defaults to the element's. */
  session(redaction?: Partial<Redaction>): Session | undefined;
  /** Shows `session` instead of the live router until the panel's Live button is pressed. */
  importSession(session: Session): void;
}

/** The `<ui-router-devtools>` class; `ui-router-devtools/define` registers it. */
export const UIRouterDevtools: {
  new (): UIRouterDevtools;
  readonly prototype: UIRouterDevtools;
} = DevtoolsPanel;
