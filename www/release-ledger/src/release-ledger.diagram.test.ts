// Generates the transition diagram from TRANSITIONS and holds the README's copy to it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  DERIVED,
  type EventType,
  GUARDS,
  IGNORED,
  INITIAL,
  type State,
  STATES,
  TRANSITIONS,
} from './release-ledger.core.ts';

const README = new URL('../README.md', import.meta.url);

/** The states `repair` can derive, drawn at the composite level. */
const DERIVABLE = ['tagged', 'published', 'released'];

const groupOf = (state: State): string | undefined =>
  state.includes('.') ? state.slice(0, state.indexOf('.')) : undefined;

const nodeOf = (state: State): string => state.replace('.', '_');

const substates = (group: string): State[] =>
  STATES.filter((state) => groupOf(state) === group);

interface Edge {
  from: State;
  to: string;
  label: string;
  inner: boolean;
}

function edgesFrom(from: State): Edge[] {
  // SAFETY: TRANSITIONS is keyed by EventType
  const entries = Object.entries(TRANSITIONS[from]) as [EventType, string][];

  return entries.flatMap(([event, target]) => {
    if (target === IGNORED || target === from) return [];

    const guard = GUARDS[from]?.[event];
    const label = guard ? `${event} (${guard.label})` : event;

    if (target === DERIVED) {
      return DERIVABLE.map((to) => ({ from, to, label, inner: false }));
    }

    // SAFETY: every other target in the table is a state
    const to = target as State;
    const inner = groupOf(to) !== undefined && groupOf(to) === groupOf(from);

    return [
      { from, to: inner ? nodeOf(to) : (groupOf(to) ?? to), label, inner },
    ];
  });
}

function outerLines(edges: Edge[]): string[] {
  const lines = new Set<string>();
  const outer = edges.filter((edge) => !edge.inner);

  for (const edge of outer) {
    const group = groupOf(edge.from);

    const shared =
      group !== undefined &&
      substates(group).every((state) =>
        outer.some(
          (other) =>
            other.from === state &&
            other.to === edge.to &&
            other.label === edge.label,
        ),
      );

    const from = shared ? group : nodeOf(edge.from);

    lines.add(`  ${from} --> ${edge.to}: ${edge.label}`);
  }

  return [...lines];
}

function compositeLines(group: string, edges: Edge[]): string[] {
  const states = substates(group);

  return [
    `  state ${group} {`,
    ...states.map(
      (state) =>
        `    state "${state.slice(group.length + 1)}" as ${nodeOf(state)}`,
    ),
    `    [*] --> ${nodeOf(states[0])}`,
    ...edges.flatMap((edge) =>
      edge.inner && groupOf(edge.from) === group
        ? [`    ${nodeOf(edge.from)} --> ${edge.to}: ${edge.label}`]
        : [],
    ),
    '  }',
  ];
}

function ignoredLines(): string[] {
  return STATES.flatMap((state) => {
    const ignored = Object.entries(TRANSITIONS[state])
      .filter(([, target]) => target === IGNORED)
      .map(([event]) => event);

    return ignored.length === 0
      ? []
      : [`  note right of ${nodeOf(state)}: ignores ${ignored.join(', ')}`];
  });
}

function mermaid(): string {
  const edges = STATES.flatMap(edgesFrom);

  const groups = [...new Set(STATES.map(groupOf))].filter(
    (group) => group !== undefined,
  );

  return [
    'stateDiagram-v2',
    ...Object.entries(INITIAL).map(
      ([event, state]) => `  [*] --> ${state}: ${event}`,
    ),
    ...groups.flatMap((group) => compositeLines(group, edges)),
    ...outerLines(edges),
    ...ignoredLines(),
  ].join('\n');
}

describe('transition diagram', () => {
  it('matches the README', () => {
    const readme = readFileSync(README, 'utf8');
    const block = /```mermaid\n([\s\S]*?)\n```/.exec(readme)?.[1];

    assert.equal(block, mermaid(), 'regenerate the README diagram');
  });
});
