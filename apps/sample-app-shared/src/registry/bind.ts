/**
 * Binds components, resolve functions and client-only config to a module's
 * state table by state name. Nothing here feeds `RegisteredStates`, so a
 * component can be typed by its state without a cycle.
 */
import type {
  LazyLoadResult,
  ResolvePolicy,
  StateDeclaration,
} from '@uirouter/core';
import type { LitStateDeclaration, UIViewInjectedProps } from 'lit-ui-router';
import { appTable } from 'sample-app-routes/state-table/app';

import type {
  OwnTokens,
  ResolveValues,
  SampleAppStateName,
  StateResolves,
  TableRow,
} from './states.js';

type Props<N extends SampleAppStateName> = UIViewInjectedProps<
  StateResolves<N>
>;

/**
 * A component state `N` can render. Checked by what it takes, so it may read
 * any subset of the resolves `N` and its ancestors provide, and no others. A
 * template returns `void`, which accepts any renderable.
 */
export type ComponentFor<N extends SampleAppStateName> =
  | ((props: Props<N>) => void)
  | ((new (props: Props<N>) => HTMLElement) & { sticky?: boolean });

/** A view of state `N`: a bare component, or an object with one. */
export type ViewFor<N extends SampleAppStateName> =
  | ComponentFor<N>
  | { component: ComponentFor<N> };

/** One resolve token's function; `deps` stay as core takes them. */
export interface Resolver<V> {
  deps?: readonly unknown[];
  resolveFn: (...deps: never[]) => V | PromiseLike<V>;
  policy?: ResolvePolicy;
}

type ResolveBinding<N extends SampleAppStateName> = [OwnTokens<N>] extends [
  never,
]
  ? { resolve?: never }
  : {
      resolve: {
        [T in OwnTokens<N> & keyof ResolveValues]: Resolver<ResolveValues[T]>;
      };
    };

// The table owns these; a binding can't restate them.
type TableKey = 'name' | 'parent' | 'url' | 'params' | 'redirectTo';

/** What binds to state `N`: everything that isn't table data. */
export type Binding<N extends SampleAppStateName> = Omit<
  StateDeclaration,
  TableKey | 'component' | 'views' | 'resolve' | 'lazyLoad'
> & {
  component?: ViewFor<N>;
  views?: Record<string, ViewFor<N>>;
} & ResolveBinding<N>;

/** A table row with its binding applied, as the router registers it. */
export type BoundState<N extends SampleAppStateName> = LitStateDeclaration & {
  name: N;
};

// Computed once; a generic parameter inferring the names doubled the sample apps' check cost.
type BindingMap = { [N in SampleAppStateName]: Binding<N> };

// A name from another module's table must be absent, so a binding can't land on the wrong module.
type OutsideTable<T extends readonly TableRow[]> = {
  [N in Exclude<SampleAppStateName, T[number]['name']>]?: never;
};

// Every row but a future state's must be bound, so the client registers each state the server serves.
type EveryRow<T extends readonly TableRow[]> = {
  [N in Exclude<T[number]['name'], `${string}.**`>]: N extends keyof BindingMap
    ? BindingMap[N]
    : never;
};

/** A module's table rows for each named state, with their bindings applied. */
export function bindStates<const T extends readonly TableRow[]>(
  table: T,
  bindings: NoInfer<Partial<BindingMap> & OutsideTable<T> & EveryRow<T>>,
): BoundState<SampleAppStateName>[] {
  // SAFETY: Partial<BindingMap>'s keys are state names
  const names = Object.keys(bindings) as SampleAppStateName[];

  return names.map((name) => {
    const row = table.find((entry) => entry.name === name);

    if (!row) throw new Error(`No state '${name}' in the module's table`);

    // SAFETY: each key's binding was checked against its own state above
    const { resolve, ...rest } = bindings[name] as Binding<SampleAppStateName>;

    const resolvables = Object.entries(resolve ?? {}).map(
      ([token, resolver]) => ({ token, ...resolver }),
    );

    const declaration = { ...row, ...rest, name, resolve: resolvables };

    // SAFETY: each component was checked against its state's resolves above, which LitStateDeclaration's default can't express
    return declaration as BoundState<SampleAppStateName>;
  });
}

type FutureRow = Extract<(typeof appTable)[number], { name: `${string}.**` }>;

/** The `app` table's future state `name`, loading its module's states. */
export function futureState(
  name: FutureRow['name'],
  lazyLoad: () => Promise<LazyLoadResult>,
): StateDeclaration {
  const row = appTable.find((entry): entry is FutureRow => entry.name === name);

  if (!row) throw new Error(`No future state '${name}' in the app table`);

  return { ...row, lazyLoad };
}
