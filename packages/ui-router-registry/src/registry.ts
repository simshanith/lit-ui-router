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

// Every dotted tail of a registered name: `a.b.c` gives `b.c | c`. Built once per program.
type Tails<S> = S extends `${string}.${infer Rest}`
  ? Rest | Tails<Rest>
  : never;

type RelativeTail = StateName | Tails<StateName>;

type Up = '^' | '^.^' | '^.^.^';

/**
 * A relative state reference, resolved against `options.relative` or the
 * uiSref's context. Its base isn't known statically, so once an app registers
 * only its tail is checked: it must end some registered name. A bare `.` is the
 * base state itself. Params stay loose.
 */
export type RelativeRef = IsRegistered extends true
  ? '.' | Up | `.${RelativeTail}` | `${Up}.${RelativeTail}`
  : `.${string}` | `^${string}`;

declare const unchecked: unique symbol;

/**
 * An explicit opt-out for a target the registry can't see, such as a name
 * built at runtime or a state registered at runtime: `name as UncheckedRef`.
 * Its params are loose. Nothing is unsafe at runtime; the target is just
 * unverified.
 */
export type UncheckedRef = string & {
  /** The brand that only a cast supplies. */
  readonly [unchecked]: true;
};

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

// A `value: null` default is a legal value to pass and what an absent param reads back.
type NullDefault<C> = null extends DefaultOf<C> ? null : never;

// An untyped non-url param is core's `any`, so only its default's type is known.
type ConfigType<C, UrlType> = C extends { type: infer T extends string }
  ? BuiltInType<T> | NullDefault<C>
  : [UrlType] extends [never]
    ? Widen<DefaultOf<C>>
    : UrlType | NullDefault<C>;

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
type LooseRelative = `.${string}` | `^${string}`;

type LooseTarget =
  | LooseRelative
  | UncheckedRef
  | StateDeclaration
  | StateObject;

// Checks a relative ref's tail per call, so the constraint above stays a small
// union. A failing ref reads as this key in the error.
type CheckRelative<T> = T extends LooseRelative
  ? T extends RelativeRef
    ? unknown
    : { readonly 'relative ref ends no registered state name': RelativeRef }
  : unknown;

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
  'go' | 'transitionTo' | 'target' | 'href' | 'is' | 'includes' | 'reload'
> {
  /** `StateService.go`, with a registered name's params required as declared. */
  go<T extends StateName | LooseTarget>(
    to: T & CheckRelative<T>,
    ...args: TargetArgs<T, TransitionOptions>
  ): TransitionPromise;

  /** `StateService.transitionTo`, typed as for `go`. */
  transitionTo<T extends StateName | LooseTarget>(
    to: T & CheckRelative<T>,
    ...args: TargetArgs<T, TransitionOptions>
  ): TransitionPromise;

  /** `StateService.target`, typed as for `go`. */
  target<T extends StateName | LooseTarget>(
    identifier: T & CheckRelative<T>,
    ...args: TargetArgs<T, TransitionOptions>
  ): TargetState;

  /** `StateService.href`, typed as for `go`. */
  href<T extends StateName | LooseTarget>(
    stateOrName: T & CheckRelative<T>,
    ...args: TargetArgs<T, HrefOptions>
  ): string;

  /** `StateService.reload`: a registered name, or an object target or {@link UncheckedRef}. */
  reload(
    reloadState?: StateName | UncheckedRef | StateDeclaration | StateObject,
  ): Promise<StateObject>;

  /** `StateService.is`, over registered names and their params. */
  is<N extends StateName>(
    stateOrName: N,
    params?: Partial<ParamsOf<N>>,
    options?: { relative?: StateDeclaration | StateObject | StateName },
  ): boolean;
  /** `StateService.is` for an {@link UncheckedRef} or an object target, with loose params. */
  is(
    stateOrName: UncheckedRef | StateDeclaration | StateObject,
    params?: RawParams,
    options?: { relative?: StateDeclaration | StateObject | StateName },
  ): boolean;

  /** `StateService.includes`, over registered names, globs and their params. */
  includes<N extends StateName>(
    stateOrName: N | StateGlob,
    params?: Partial<ParamsOf<N>>,
    options?: TransitionOptions,
  ): boolean;
  /** `StateService.includes` for an {@link UncheckedRef} or an object target, with loose params. */
  includes(
    stateOrName: UncheckedRef | StateDeclaration | StateObject,
    params?: RawParams,
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
    stateOrName: StateGlob | UncheckedRef | StateDeclaration | StateObject,
    params?: RawParams,
  ): boolean;
}

type SnapshotFor<N extends StateName> = SnapshotBase & {
  /** The active state's declaration. */
  readonly current: StateDeclaration & {
    /** The active state's name. */
    readonly name: N;
  };
  /** The active state's params, its ancestors' included. */
  readonly params: Readonly<ResolvedParamsOf<N>>;
};

/**
 * A typed view of the route snapshot the reactive packages share. Unnarrowed
 * it is one type, not a union per state; `includes(name)` narrows it to that
 * state's subtree.
 */
export type TypedRouteSnapshot = IsRegistered extends true
  ? SnapshotBase & {
      /** The active state's declaration, if a transition has succeeded. */
      readonly current:
        | (StateDeclaration & {
            /** The active state's name. */
            readonly name: StateName;
          })
        | undefined;
      /** No params until `includes(name)` narrows the snapshot. */
      readonly params: Readonly<Record<never, never>>;
    }
  : SnapshotBase & {
      /** The active state's declaration, if a transition has succeeded. */
      readonly current: StateDeclaration | undefined;
      /** The active state's params. */
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

// ---- the members the adapters' RouteTypes interfaces read ------------------

// Keyed by registered name, the snapshot narrowed to that state's subtree.
type Snapshots = IsRegistered extends true
  ? { [N in StateName]: ActiveSnapshot<N> }
  : Record<never, never>;

/**
 * The registry's types in the shape the adapters' `RouteTypes` interfaces
 * read. The `ui-router-registry/signals`, `/effect` and `/mobx` entry points
 * fill their package's interface from these members.
 */
export interface RegisteredRouteTypes {
  /** The route snapshot, typed by the registered states. */
  snapshot: TypedRouteSnapshot;
  /**
   * Keyed by registered state name, the snapshot narrowed to that state's
   * subtree; empty until an app registers.
   */
  snapshots: Snapshots;
}
