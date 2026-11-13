import { fold, type Model } from './fold.ts';
import type { Outcome, Session } from './schema.ts';

export type EdgeOutcome = Outcome | 'running';

/** The traffic one ordered pair of states has seen. A router declares no transitions, so every edge is an observed one. */
export interface ObservedEdge {
  /** The state the transitions left; `''` is the root, which the first transition leaves. */
  from: string;
  to: string;
  /** Every transition recorded for the pair, whatever its outcome. */
  count: number;
  outcomes: Partial<Record<EdgeOutcome, number>>;
  /** Transition ids, in start order. */
  ids: number[];
}

// The edges of a folded session; the panel keeps its model folded already.
export const edgesOf = (
  model: Pick<Model, 'states' | 'txs'>,
): ObservedEdge[] => {
  const known = new Set(model.states.map((state) => state.name));
  const edges = new Map<string, ObservedEdge>();

  for (const tx of model.txs) {
    if (!known.has(tx.to) || (tx.from !== '' && !known.has(tx.from))) continue;

    const key = JSON.stringify([tx.from, tx.to]);

    const edge = edges.get(key) ?? {
      from: tx.from,
      to: tx.to,
      count: 0,
      outcomes: {},
      ids: [],
    };

    const outcome = tx.result?.outcome ?? 'running';
    edge.count += 1;
    edge.outcomes[outcome] = (edge.outcomes[outcome] ?? 0) + 1;
    edge.ids.push(tx.id);
    edges.set(key, edge);
  }

  return [...edges.values()];
};

/**
 * Aggregates a recorded session into one edge per ordered pair of states, in order of first appearance.
 * A target that names no registered state has no edge.
 */
export const observedEdges = (
  session: Pick<Session, 'events'>,
): ObservedEdge[] => edgesOf(fold(session.events));

// The line weight for a count: 1px for 1, 2px for 2 to 3, 3px for 4 or more.
export const edgeWeight = (count: number): 1 | 2 | 3 => {
  if (count >= 4) return 3;

  return count >= 2 ? 2 : 1;
};
