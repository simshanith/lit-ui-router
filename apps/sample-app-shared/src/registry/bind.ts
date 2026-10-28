/**
 * Binds components, resolve functions and client-only config to the shared
 * state table by state name. Nothing here feeds `Register`, so a component can
 * be typed by its state without a cycle.
 */
import type {
  LazyLoadResult,
  ResolvePolicy,
  StateDeclaration,
} from '@uirouter/core';
import type { LitStateDeclaration, UIViewInjectedProps } from 'lit-ui-router';
import { stateTable } from 'sample-app-routes/state-table';

import type {
  OwnTokens,
  ResolveValues,
  SampleAppStateName,
  StateResolves,
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

const rowOf = (name: SampleAppStateName) => {
  const row = stateTable.find((entry) => entry.name === name);

  if (!row) throw new Error(`No state '${name}' in the state table`);

  return row;
};

/** The table rows for each named state, with their bindings applied. */
export function bindStates<N extends SampleAppStateName>(bindings: {
  [K in N]: Binding<K>;
}): BoundState<N>[] {
  // SAFETY: the keys are exactly N, as the parameter's mapped type requires
  const names = Object.keys(bindings) as N[];

  return names.map((name) => {
    // SAFETY: each key's binding was checked against its own state above
    const { resolve, ...rest } = bindings[name] as Binding<SampleAppStateName>;

    const resolvables = Object.entries(resolve ?? {}).map(
      ([token, resolver]) => ({ token, ...resolver }),
    );

    const declaration = { ...rowOf(name), ...rest, name, resolve: resolvables };

    // SAFETY: each component was checked against its state's resolves above, which LitStateDeclaration's default can't express
    return declaration as BoundState<N>;
  });
}

/** A future state for `name`'s subtree, at the url the table gives `name`. */
export function futureState(
  name: SampleAppStateName,
  lazyLoad: () => Promise<LazyLoadResult>,
): StateDeclaration {
  const { parent, url } = { parent: undefined, url: undefined, ...rowOf(name) };

  return { name: `${name}.**`, parent, url, lazyLoad };
}
