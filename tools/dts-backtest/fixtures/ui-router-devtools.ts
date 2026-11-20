import { UIRouter } from '@uirouter/core';
import {
  observedEdges,
  record,
  type ObservedEdge,
  type Recorder,
  type RouterEvent,
  type Session,
  type SpanRecord,
  viewTree,
  type ViewNode,
} from 'ui-router-devtools';
import { reportToConsole } from 'ui-router-devtools/console';
import { UIRouterDevtools } from 'ui-router-devtools/define';
import { litViewLocator } from 'ui-router-devtools/lit-ui-router';
import { reportToPerformance } from 'ui-router-devtools/performance';
import {
  DevtoolsPlugin,
  type DevtoolsPluginOptions,
} from 'ui-router-devtools/plugin';
import {
  type NormalisedTransition,
  settled,
  transitions,
} from 'ui-router-devtools/testing';

const router = new UIRouter();

const options: DevtoolsPluginOptions = {
  timeResolves: true,
  redaction: { params: ['id'] },
  viewLocator: litViewLocator,
};

const element: UIRouterDevtools = router.plugin(
  DevtoolsPlugin,
  options,
).element;

const recorder: Recorder = record(router, { limit: 500 });

const session: Session = recorder.session({ messages: false });

export const events: readonly RouterEvent[] = session.events;

export const edges: ObservedEdge[] = observedEdges(session);

export const views: ViewNode[] = viewTree([]);

export const log: NormalisedTransition[] = transitions(recorder);

export const stops: (() => void)[] = [
  reportToConsole(recorder),
  reportToPerformance(recorder.events),
];

const span: SpanRecord | undefined = element.spans[0];

if (span) element.addSpan(span);

export const done: Promise<void> = settled(recorder);

export const created: UIRouterDevtools = document.createElement(
  'ui-router-devtools',
);

export const constructed: UIRouterDevtools = new UIRouterDevtools();
