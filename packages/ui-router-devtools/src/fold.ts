import type {
  ConfigEvent,
  InvalidEvent,
  Params,
  PhaseEvent,
  ResolveEvent,
  ResultEvent,
  RouterEvent,
  StateInfo,
  TransitionEvent,
} from './schema.ts';

export type TxResult = Omit<ResultEvent, 'v' | 'seq' | 'type' | 'id'>;

// One log entry. Invalid targets have no Transition, so they take their event's negated `seq` as id.
export interface Tx extends Omit<TransitionEvent, 'v' | 'seq' | 'type'> {
  marks: PhaseEvent[];
  resolves: ResolveEvent[];
  result?: TxResult;
  successor?: number;
}

export interface Model {
  config: ConfigEvent | null;
  states: StateInfo[];
  current: { name: string; params: Params };
  txs: Tx[];
}

export const emptyModel = (): Model => ({
  config: null,
  states: [],
  current: { name: '', params: {} },
  txs: [],
});

const patch = (model: Model, id: number, change: (tx: Tx) => Partial<Tx>) => ({
  ...model,
  txs: model.txs.map((tx) => (tx.id === id ? { ...tx, ...change(tx) } : tx)),
});

const has = (model: Model, id: number) => model.txs.some((tx) => tx.id === id);

const invalidTx = (invalid: InvalidEvent): Tx => ({
  id: -invalid.seq,
  t: invalid.t,
  from: invalid.from,
  to: invalid.to,
  fromParams: {},
  toParams: invalid.toParams,
  entering: [],
  exiting: [],
  retained: [],
  redirectedFrom: null,
  options: {
    source: 'unknown',
    location: true,
    reload: false,
    inherit: true,
    supercede: true,
  },
  dynamic: false,
  marks: [],
  resolves: [],
  result: { t: invalid.t, outcome: 'invalid' },
});

// Events for transitions the ring buffer has already dropped are ignored, and so are event types this version does not know.
export const apply = (model: Model, event: RouterEvent): Model => {
  switch (event.type) {
    case 'config':
      return { ...model, config: event };
    case 'states':
      return { ...model, states: event.states };
    case 'current':
      return { ...model, current: { name: event.name, params: event.params } };
    case 'transition': {
      const { v: _v, seq: _seq, type: _type, ...start } = event;

      const next = {
        ...model,
        txs: [...model.txs, { ...start, marks: [], resolves: [] }],
      };

      return start.redirectedFrom === null
        ? next
        : patch(next, start.redirectedFrom, () => ({ successor: start.id }));
    }

    case 'phase':
      return has(model, event.id)
        ? patch(model, event.id, (tx) => ({ marks: [...tx.marks, event] }))
        : model;
    case 'resolve':
      return has(model, event.id)
        ? patch(model, event.id, (tx) => ({
            resolves: [...tx.resolves, event],
          }))
        : model;
    case 'result': {
      const { v: _v, seq: _seq, type: _type, id, ...result } = event;

      return has(model, id) ? patch(model, id, () => ({ result })) : model;
    }

    case 'invalid':
      return { ...model, txs: [...model.txs, invalidTx(event)] };
    default:
      return model;
  }
};

export const fold = (events: readonly RouterEvent[]): Model =>
  events.reduce(apply, emptyModel());

// A future state registers as `name.**`; a redirect names it without the suffix.
export const bareName = (name: string): string =>
  name.endsWith('.**') ? name.slice(0, -3) : name;

// A state's ancestors, nearest first, by the declared parent; a `parent` property need not match the dotted name.
export const ancestorsOf = (
  states: readonly StateInfo[],
  name: string,
): string[] => {
  const parents = new Map(states.map((s) => [s.name, s.parent]));
  const chain: string[] = [];

  for (
    let parent = parents.get(name);
    parent && !chain.includes(parent);
    parent = parents.get(parent)
  )
    chain.push(parent);

  return chain;
};

export const originOf = (txs: readonly Tx[], tx: Tx): Tx | undefined =>
  txs.find((t) => t.successor === tx.id);

export const durationOf = (txs: readonly Tx[], tx: Tx, now: number): number =>
  (tx.result?.t ?? now) - (originOf(txs, tx) ?? tx).t;
