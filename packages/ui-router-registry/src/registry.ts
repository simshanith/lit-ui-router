/**
 * A typed state registry for `@uirouter/core`.
 *
 * An app fills in {@link Register} by module augmentation with its `as const`
 * state declarations; every type here derives state names and params from
 * them. Until an app registers, each type falls back to core's loose
 * `string` and `RawParams`. Nothing here emits JavaScript.
 */
/* oxlint-disable typescript/no-redundant-type-constituents -- StateName is `string` until an app registers; the unions are written for the registered case */
import type {
  HrefOptions,
  RawParams,
  StateDeclaration,
  StateObject,
  TargetState,
  Transition,
  TransitionOptions,
  TransitionPromise,
  StateService,
} from '@uirouter/core';

/**
 * The app's state declarations, filled in by module augmentation:
 *
 * ```ts
 * declare module 'ui-router-registry' {
 *   interface Register {
 *     states: (typeof appStates)[number] | (typeof lazyStates)[number];
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- filled in by module augmentation
export interface Register {}

type Registered = Register extends { states: infer S } ? S : never;

type IsRegistered = [Registered] extends [never] ? false : true;

// A class-declared state (`static __uiRouterState`) contributes its instance.
type Declaration<D> = D extends abstract new (...args: never) => infer I
  ? I
  : D;

type Declarations = Declaration<Registered>;

// A widened `string` name can't be registered, and a future state's `name.**`
// placeholder is replaced by the states its module registers.
type LiteralName<D> = D extends { name: infer N extends string }
  ? string extends N
    ? never
    : N extends `${string}.**`
      ? never
      : N
  : never;

/** A registered state name; any string until an app registers. */
export type StateName = IsRegistered extends true
  ? LiteralName<Declarations>
  : string;

/** A relative state reference, resolved against `options.relative` or the uiSref's context. */
export type RelativeRef = `.${string}` | `^${string}`;

/** A glob that `includes` accepts as well as a state name. */
export type StateGlob = StateName | `${StateName}.*` | `${StateName}.**`;

// Built once per program, so a name lookup is an index, not a scan of every
// declaration. Keyed by literal names only: a widened name would index every string.
type ByName = {
  [D in Declarations as LiteralName<D>]: D;
};

type DeclarationOf<N> = N extends keyof ByName ? ByName[N] : never;

type DropLast<
  S extends string,
  Acc extends string = '',
> = S extends `${infer Head}.${infer Tail}`
  ? DropLast<Tail, Acc extends '' ? Head : `${Acc}.${Head}`>
  : Acc;

type ParentName<D> = D extends { parent: infer P extends string }
  ? P
  : D extends { name: infer N extends string }
    ? DropLast<N>
    : '';

// ---- params from the url ---------------------------------------------------

type Split<
  S extends string,
  Sep extends string,
> = S extends `${infer Head}${Sep}${infer Tail}` ? Head | Split<Tail, Sep> : S;

type UrlOf<D> = D extends { url: infer U extends string } ? U : '';

type PathPart<U extends string> = U extends `${infer P}?${string}` ? P : U;

type QueryPart<U extends string> = U extends `${string}?${infer Q}` ? Q : '';

// [name, type] for `:name`, `{name}` and `{name:type}`.
type PlaceholderEntry<S extends string> = S extends `:${infer Name}`
  ? [Name, 'path']
  : S extends `{${infer Body}}`
    ? Body extends `${infer Name}:${infer Type}`
      ? [Name, Type]
      : [Body, 'path']
    : never;

type QueryEntry<S extends string> = S extends ''
  ? never
  : S extends `{${string}}`
    ? PlaceholderEntry<S>
    : [S, 'query'];

type PathEntries<D> = PlaceholderEntry<Split<PathPart<UrlOf<D>>, '/'>>;

type QueryEntries<D> = QueryEntry<Split<QueryPart<UrlOf<D>>, '&'>>;

// Core's built-in param types; a regex placeholder (`{id:[0-9]+}`) or a custom type reads as `string`.
type BuiltInType<T> = T extends 'int'
  ? number
  : T extends 'bool'
    ? boolean
    : T extends 'date'
      ? Date
      : T extends 'json' | 'any'
        ? unknown
        : string;

// ---- params from the `params` block ----------------------------------------

type ParamsBlock<D> = D extends { params: infer P extends object }
  ? P
  : Record<never, never>;

// Core treats a config without these keys as shorthand for `{ value: config }`.
type IsConfig<C> = C extends
  | { value: unknown }
  | { type: unknown }
  | { squash: unknown }
  | { array: unknown }
  | { dynamic: unknown }
  ? true
  : false;

type DefaultOf<C> =
  IsConfig<C> extends true ? (C extends { value: infer V } ? V : never) : C;

type HasDefault<C> =
  IsConfig<C> extends true
    ? C extends { value: unknown }
      ? true
      : false
    : true;

type Widen<V> = V extends () => infer R
  ? Widen<R>
  : V extends string
    ? string
    : V extends number
      ? number
      : V extends boolean
        ? boolean
        : V extends null | undefined
          ? unknown
          : V;

type ConfigType<C, UrlType> = C extends { type: infer T extends string }
  ? BuiltInType<T>
  : [UrlType] extends [never]
    ? Widen<DefaultOf<C>>
    : UrlType;

type UrlKeys<D> = PathEntries<D>[0] | QueryEntries<D>[0];

type OwnKeys<D> = UrlKeys<D> | (keyof ParamsBlock<D> & string);

type UrlType<D, K> = BuiltInType<
  Extract<PathEntries<D> | QueryEntries<D>, [K, string]>[1]
>;

type KeyType<D, K> = K extends keyof ParamsBlock<D>
  ? ConfigType<ParamsBlock<D>[K], K extends UrlKeys<D> ? UrlType<D, K> : never>
  : UrlType<D, K>;

type IsQuery<D, K> = K extends QueryEntries<D>[0] ? true : false;

// Optional to pass: declared with a default, or a query param.
type IsOptionalInput<D, K> = K extends keyof ParamsBlock<D>
  ? HasDefault<ParamsBlock<D>[K]> extends true
    ? true
    : IsQuery<D, K>
  : IsQuery<D, K>;

// Optional to read: a query param core had no default to fill in.
type IsOptionalOutput<D, K> =
  IsQuery<D, K> extends true
    ? K extends keyof ParamsBlock<D>
      ? HasDefault<ParamsBlock<D>[K]> extends true
        ? false
        : true
      : true
    : false;

type OwnParams<D, Optional extends 'input' | 'output'> = {
  [
    K in OwnKeys<D> as (
      Optional extends 'input' ? IsOptionalInput<D, K> : IsOptionalOutput<D, K>
    ) extends true
      ? never
      : K
  ]: KeyType<D, K>;
} & {
  [
    K in OwnKeys<D> as (
      Optional extends 'input' ? IsOptionalInput<D, K> : IsOptionalOutput<D, K>
    ) extends true
      ? K
      : never
  ]?: KeyType<D, K>;
};

type LineageParams<N, Optional extends 'input' | 'output'> = [
  DeclarationOf<N>,
] extends [never]
  ? unknown
  : OwnParams<DeclarationOf<N>, Optional> &
      LineageParams<ParentName<DeclarationOf<N>>, Optional>;

type Simplify<T> = { [K in keyof T]: T[K] };

// Core gives every state the `#` param, which also keeps a param-less state's
// object non-empty, so an undeclared key is an excess property.
type HashParam = { '#'?: string | null };

/** The params a state accepts: its own and its ancestors', defaults optional. */
export type ParamsOf<N extends StateName> = IsRegistered extends true
  ? Simplify<LineageParams<N, 'input'> & HashParam>
  : RawParams;

/** The params a state reads back once active: defaults filled in. */
export type ResolvedParamsOf<N extends StateName> = IsRegistered extends true
  ? Simplify<LineageParams<N, 'output'> & HashParam>
  : RawParams;

/** The state and its ancestors, by name. */
export type LineageOf<N> = [DeclarationOf<N>] extends [never]
  ? never
  : N | LineageOf<ParentName<DeclarationOf<N>>>;

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * The arguments after a state name: params are required exactly when the
 * state has a required param.
 */
export type ParamArgs<N extends StateName, Options> = IsRegistered extends true
  ? [RequiredKeys<ParamsOf<N>>] extends [never]
    ? [params?: ParamsOf<N>, options?: Options]
    : [params: ParamsOf<N>, options?: Options]
  : [params?: RawParams, options?: Options];

// Object targets (a `transition.from()`, a `TargetState`'s state) stay loose.
type LooseTarget = RelativeRef | StateDeclaration | StateObject;

/** The arguments after a target: typed for a state name, loose otherwise. */
export type TargetArgs<T, Options> = T extends StateName
  ? ParamArgs<T, Options>
  : [params?: RawParams, options?: Options];

/**
 * A typed view of core's `StateService`. Core's own class is assignable to it,
 * so a typed getter or field needs no cast and emits nothing.
 */
export interface TypedStateService extends Omit<
  StateService,
  'go' | 'transitionTo' | 'target' | 'href' | 'is' | 'includes'
> {
  go<T extends StateName | LooseTarget>(
    to: T,
    ...args: TargetArgs<T, TransitionOptions>
  ): TransitionPromise;

  transitionTo<T extends StateName | LooseTarget>(
    to: T,
    ...args: TargetArgs<T, TransitionOptions>
  ): TransitionPromise;

  target<T extends StateName | LooseTarget>(
    identifier: T,
    ...args: TargetArgs<T, TransitionOptions>
  ): TargetState;

  href<T extends StateName | LooseTarget>(
    stateOrName: T,
    ...args: TargetArgs<T, HrefOptions>
  ): string;

  is<N extends StateName>(
    stateOrName: N | StateDeclaration | StateObject,
    params?: Partial<ParamsOf<N>>,
    options?: { relative?: StateDeclaration | StateObject | StateName },
  ): boolean;

  includes<N extends StateName>(
    stateOrName: N | StateGlob | StateDeclaration | StateObject,
    params?: Partial<ParamsOf<N>>,
    options?: TransitionOptions,
  ): boolean;
}

// ---- the route snapshot the agnostic reactive packages share ---------------

interface SnapshotBase {
  /** The transition that produced this snapshot. */
  readonly transition: Transition | undefined;

  /** Narrows the snapshot to the states at or below `state`. */
  includes<N extends StateName>(state: N): this is ActiveSnapshot<N>;
  includes(
    stateOrName: StateGlob | StateDeclaration | StateObject,
    params?: RawParams,
  ): boolean;
}

type SnapshotFor<N extends StateName> = SnapshotBase & {
  readonly current: StateDeclaration & { readonly name: N };
  readonly params: Readonly<ResolvedParamsOf<N>>;
};

/**
 * A typed view of the route snapshot the reactive packages share. Unnarrowed
 * it is one type, not a union per state; `includes(name)` narrows it to that
 * state's subtree.
 */
export type TypedRouteSnapshot = IsRegistered extends true
  ? SnapshotBase & {
      readonly current:
        | (StateDeclaration & { readonly name: StateName })
        | undefined;
      readonly params: Readonly<Record<never, never>>;
    }
  : SnapshotBase & {
      readonly current: StateDeclaration | undefined;
      readonly params: RawParams;
    };

type EachSnapshot<N> = N extends StateName ? SnapshotFor<N> : never;

// The registered states whose lineage passes through G.
type Subtree<G extends StateName> = {
  [N in StateName]: G extends LineageOf<N> ? N : never;
}[StateName];

type ActiveSnapshot<G extends StateName> = IsRegistered extends true
  ? EachSnapshot<Subtree<G>>
  : TypedRouteSnapshot;
