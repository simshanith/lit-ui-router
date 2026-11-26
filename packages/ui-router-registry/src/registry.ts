/**
 * A typed state registry for `@uirouter/core`.
 *
 * An app fills in {@link RegisteredStates} by module augmentation, one module
 * at a time, with its `as const` state declarations; every type here derives
 * state names and params from them; {@link Register} takes them at one site
 * instead. Until an app registers, each type falls back to core's loose
 * `string` and `RawParams`. Nothing here emits JavaScript.
 */
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

// A class-declared state (`static __uiRouterState`) contributes its instance.
type Declaration<D> = D extends abstract new (...args: never) => infer I
  ? I
  : D;

// A widened `string` name would index every string, so it registers no key.
type NameKey<D> =
  Declaration<D> extends { name: infer N extends string }
    ? string extends N
      ? never
      : N
    : never;

/**
 * The app's state declarations keyed by name, filled in by module
 * augmentation. Each module registers its own `as const` table, lazy modules
 * included, and a file that imports none of them still sees every name:
 *
 * ```ts
 * declare module 'ui-router-registry' {
 *   interface RegisteredStates extends StatesOf<typeof contactsStates> {}
 * }
 * ```
 *
 * A class-declared state can be registered by hand:
 * `interface RegisteredStates { about: typeof AboutState }`.
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- filled in by module augmentation
export interface RegisteredStates {}

/** A table of state declarations keyed by name, for {@link RegisteredStates} to extend. */
export type StatesOf<
  T extends readonly {
    /** The state's name, or `Function.name` for a class-declared state. */
    name: string;
  }[],
> = {
  [R in T[number] as NameKey<R>]: R;
};

// A row's name, unless the row is the one registered under it.
type Collision<R> = R extends unknown
  ? NameKey<R> extends infer N extends keyof RegisteredStates
    ? [R, RegisteredStates[N]] extends [RegisteredStates[N], R]
      ? never
      : N
    : NameKey<R>
  : never;

/**
 * The names in `T` whose rows aren't the ones registered under them; `never`
 * when every row in `T` is. A table that never augmented
 * {@link RegisteredStates} collides on every name. {@link AssertNoCollisions}
 * asserts it.
 */
export type CollisionsOf<
  T extends readonly {
    /** The state's name, or `Function.name` for a class-declared state. */
    name: string;
  }[],
> = Collision<T[number]>;

/**
 * `T` itself, when every row in it is the one registered under its name.
 * Two modules that register one name with different rows keep only the first,
 * and on TypeScript 5 `skipLibCheck` hides the error, so a module can assert
 * its table where it registers it:
 *
 * ```ts
 * export type ContactsStates = AssertNoCollisions<typeof contactsStates>;
 * ```
 *
 * A row that collides fails the constraint at that line, keyed
 * `'not the row registered under'` with the state's name.
 */
export type AssertNoCollisions<
  T extends readonly {
    /** The state's name, or `Function.name` for a class-declared state. */
    name: string;
  }[] & {
    readonly [I in keyof T]: [Collision<T[I]>] extends [never]
      ? T[I]
      : {
          /** The name the row collides on. */
          readonly 'not the row registered under': Collision<T[I]>;
        };
  },
> = T;

/**
 * The app's state declarations at one augmentation site, read alongside
 * {@link RegisteredStates}:
 *
 * ```ts
 * declare module 'ui-router-registry' {
 *   interface Register {
 *     states: (typeof appStates)[number] | (typeof lazyStates)[number];
 *   }
 * }
 * ```
 */
// oxlint-disable-next-line typescript/no-empty-object-type -- filled in by module augmentation
export interface Register {}

type Registered =
  | (Register extends { states: infer S } ? S : never)
  | RegisteredStates[keyof RegisteredStates];

type IsRegistered = [Registered] extends [never] ? false : true;

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

type UrlOf<D> = D extends { url: infer U extends string } ? U : '';

type WordChars<S extends string, Acc = never> = S extends `${infer C}${infer R}`
  ? WordChars<R, Acc | C>
  : Acc;

// Core's placeholder name characters: `[\w\[\]]`.
type WordChar =
  WordChars<'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_[]'>;

// JavaScript's `\s`.
type Space =
  | ' '
  | '\t'
  | '\n'
  | '\r'
  | '\f'
  | '\v'
  | '\u00a0'
  | '\u1680'
  | '\u2000'
  | '\u2001'
  | '\u2002'
  | '\u2003'
  | '\u2004'
  | '\u2005'
  | '\u2006'
  | '\u2007'
  | '\u2008'
  | '\u2009'
  | '\u200a'
  | '\u2028'
  | '\u2029'
  | '\u202f'
  | '\u205f'
  | '\u3000'
  | '\ufeff';

// Walks the url as core's `placeholder` regex does: [path entries, query string].
type ScanPath<S extends string, Acc = never> = S extends `${infer C}${infer R}`
  ? C extends '?' | ':' | '*' | '{'
    ? C extends '?'
      ? [Acc, R]
      : C extends '{'
        ? ScanCurly<R, '', Acc, R>
        : ScanName<R, '', Acc>
    : ScanPath<R, Acc>
  : [Acc, ''];

type ScanName<
  S extends string,
  Name extends string,
  Acc,
> = S extends `${infer C}${infer R}`
  ? C extends WordChar
    ? ScanName<R, `${Name}${C}`, Acc>
    : Name extends ''
      ? ScanPath<S, Acc>
      : ScanPath<S, Acc | [Name, 'path']>
  : Name extends ''
    ? [Acc, '']
    : [Acc | [Name, 'path'], ''];

// `{name}` or `{name:body}`; anything else leaves the `{` as literal text, resuming at `Resume`.
type ScanCurly<
  S extends string,
  Name extends string,
  Acc,
  Resume extends string,
> = S extends `${infer C}${infer R}`
  ? C extends WordChar
    ? ScanCurly<R, `${Name}${C}`, Acc, Resume>
    : Name extends ''
      ? ScanPath<Resume, Acc>
      : C extends '}'
        ? ScanPath<R, Acc | [Name, 'path']>
        : C extends ':'
          ? ScanBody<SkipSpace<R>, Name, '', false, Acc, Resume>
          : ScanPath<Resume, Acc>
  : ScanPath<Resume, Acc>;

type SkipSpace<S extends string> = S extends `${infer C}${infer R}`
  ? C extends Space
    ? SkipSpace<R>
    : S
  : S;

// The characters JavaScript's `.` doesn't match.
type LineTerminator = '\n' | '\r' | '\u2028' | '\u2029';

// A body is one or more of: a non-brace character, a `\` escape, or one level of `{...}`.
// `Q` resumes in the query scanner instead of the path scanner.
type ScanBody<
  S extends string,
  Name extends string,
  Body extends string,
  Nested extends boolean,
  Acc,
  Resume extends string,
  Q extends boolean = false,
> = S extends `${infer C}${infer R}`
  ? C extends '\\'
    ? R extends `${infer E}${infer T}`
      ? E extends LineTerminator
        ? ScanNext<Q, Resume, Acc>
        : ScanBody<T, Name, `${Body}${C}${E}`, Nested, Acc, Resume, Q>
      : ScanNext<Q, Resume, Acc>
    : C extends '{'
      ? Nested extends true
        ? ScanNext<Q, Resume, Acc>
        : ScanBody<R, Name, `${Body}${C}`, true, Acc, Resume, Q>
      : C extends '}'
        ? Nested extends true
          ? ScanBody<R, Name, `${Body}${C}`, false, Acc, Resume, Q>
          : Body extends ''
            ? ScanNext<Q, Resume, Acc>
            : ScanNext<Q, R, Acc | [Name, Body]>
        : ScanBody<R, Name, `${Body}${C}`, Nested, Acc, Resume, Q>
  : ScanNext<Q, Resume, Acc>;

type ScanNext<Q extends boolean, S extends string, Acc> = Q extends true
  ? ScanQuery<S, Acc>
  : ScanPath<S, Acc>;

type Scan<D> = ScanPath<UrlOf<D>>;

// Core's query name characters: `[\w\[\].-]`.
type QueryChar = WordChar | '.' | '-';

// Walks the query as core's `searchPlaceholder` regex does; other characters only separate names.
type ScanQuery<S extends string, Acc = never> = S extends `${infer C}${infer R}`
  ? C extends QueryChar
    ? ScanQueryName<R, C, Acc>
    : C extends ':'
      ? ScanQueryName<R, '', Acc>
      : C extends '{'
        ? ScanQueryCurly<R, '', Acc, R>
        : ScanQuery<R, Acc>
  : Acc;

type ScanQueryName<
  S extends string,
  Name extends string,
  Acc,
> = S extends `${infer C}${infer R}`
  ? C extends QueryChar
    ? ScanQueryName<R, `${Name}${C}`, Acc>
    : Name extends ''
      ? ScanQuery<S, Acc>
      : ScanQuery<S, Acc | [Name, 'query']>
  : Name extends ''
    ? Acc
    : Acc | [Name, 'query'];

type ScanQueryCurly<
  S extends string,
  Name extends string,
  Acc,
  Resume extends string,
> = S extends `${infer C}${infer R}`
  ? C extends QueryChar
    ? ScanQueryCurly<R, `${Name}${C}`, Acc, Resume>
    : Name extends ''
      ? ScanQuery<Resume, Acc>
      : C extends '}'
        ? ScanQuery<R, Acc | [Name, 'query']>
        : C extends ':'
          ? ScanBody<SkipSpace<R>, Name, '', false, Acc, Resume, true>
          : ScanQuery<Resume, Acc>
  : ScanQuery<Resume, Acc>;

type PathEntries<D> = Scan<D>[0];

type QueryEntries<D> = ScanQuery<Scan<D>[1]>;

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

// A default that is, or returns, `undefined` leaves the read-back `undefined`.
type FillsDefault<C> =
  HasDefault<C> extends true
    ? undefined extends Invoked<DefaultOf<C>>
      ? false
      : true
    : false;

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

// A default that is, or returns, `null` is a legal value to pass and what an absent param reads back.
type NullDefault<C> = null extends Invoked<DefaultOf<C>> ? null : never;

// Core's array mode: an explicit `array` wins, then a `name[]` id, then `'auto'` for a query param.
type IsArray<C, K, Q = false> = C extends { array: infer A }
  ? QueryAuto<A, Q>
  : K extends `${string}[]`
    ? true
    : Q extends true
      ? 'query-default'
      : false;

// Core throws on `'auto'` outside the query, so such a config stays scalar.
type QueryAuto<A, Q> = A extends 'auto' ? (Q extends true ? A : false) : A;

// Core wraps a scalar passed to an array param; an unset query `array` reads back scalar, an approximation.
type ArrayOf<T, A, Mode> = A extends true
  ? Mode extends 'input'
    ? T | readonly T[]
    : T[]
  : A extends 'auto' | 'query-default'
    ? Mode extends 'input'
      ? T | readonly T[]
      : A extends 'auto'
        ? T | T[]
        : T
    : T;

// Only `go` (`inherit: true`) wraps a scalar default on an array param; `transitionTo` reads it back as is.
type ScalarDefault<C, K> =
  IsArray<C, K> extends true
    ? Exclude<Invoked<DefaultOf<C>>, readonly unknown[] | null | undefined>
    : never;

type Invoked<V> = V extends () => infer R ? R : V;

// A scalar default and an array one both name the element type.
type DefaultElement<V> = [V] extends [never]
  ? unknown
  : Widen<V> extends infer W
    ? [W] extends [readonly (infer E)[]]
      ? [E] extends [never]
        ? unknown
        : Widen<E>
      : W
    : never;

// An untyped non-url param is core's `any`, so only its default's type is known.
type ConfigType<C, UrlType, K, Mode, Q> = C extends {
  type: infer T extends string;
}
  ? WithDefaults<ArrayOf<BuiltInType<T>, IsArray<C, K, Q>, Mode>, C, K>
  : [UrlType] extends [never]
    ? IsArray<C, K> extends true
      ? WithDefaults<ArrayOf<DefaultElement<DefaultOf<C>>, true, Mode>, C, K>
      : Widen<DefaultOf<C>>
    : WithDefaults<ArrayOf<UrlType, IsArray<C, K, Q>, Mode>, C, K>;

type WithDefaults<T, C, K> = T | NullDefault<C> | ScalarDefault<C, K>;

type UrlKeys<D> = PathEntries<D>[0] | QueryEntries<D>[0];

type OwnKeys<D> = UrlKeys<D> | (keyof ParamsBlock<D> & string);

type UrlType<D, K> = BuiltInType<
  Extract<PathEntries<D> | QueryEntries<D>, [K, string]>[1]
>;

type DeclaredType<D, K, Mode> = K extends keyof ParamsBlock<D>
  ? ConfigType<
      ParamsBlock<D>[K],
      K extends UrlKeys<D> ? UrlType<D, K> : never,
      K,
      Mode,
      IsQuery<D, K>
    >
  : ArrayOf<UrlType<D, K>, IsArray<unknown, K, IsQuery<D, K>>, Mode>;

// The built-in types whose pattern matches an empty path segment; a regex or custom type stays as declared.
type EmptyMatching = 'path' | 'string' | 'json' | 'any' | 'query' | 'hash';

// A `ParamType` object maps to a name outside `EmptyMatching`.
type PathTypeName<C, D, K> = C extends { type: infer T }
  ? T extends string
    ? T
    : 'custom'
  : Extract<PathEntries<D>, [K, string]>[1];

type EmptyArray<C, D, K> =
  true extends IsArray<C, K>
    ? PathTypeName<C, D, K> extends infer T
      ? T extends EmptyMatching
        ? undefined
        : never
      : never
    : never;

// Core reads an empty array path segment back as `undefined` when no default fills it in.
type EmptySegment<D, K> = K extends PathEntries<D>[0]
  ? K extends keyof ParamsBlock<D>
    ? FillsDefault<ParamsBlock<D>[K]> extends true
      ? never
      : EmptyArray<ParamsBlock<D>[K], D, K>
    : EmptyArray<unknown, D, K>
  : never;

type KeyType<D, K, Mode> =
  | DeclaredType<D, K, Mode>
  | (Mode extends 'output' ? EmptySegment<D, K> : never);

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
      ? FillsDefault<ParamsBlock<D>[K]> extends true
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
  ]: KeyType<D, K, Optional>;
} & {
  [
    K in OwnKeys<D> as (
      Optional extends 'input' ? IsOptionalInput<D, K> : IsOptionalOutput<D, K>
    ) extends true
      ? K
      : never
  ]?: KeyType<D, K, Optional>;
};

type LineageParams<N, Optional extends 'input' | 'output'> = [
  DeclarationOf<N>,
] extends [never]
  ? unknown
  : WithAncestors<
      DeclarationOf<N>,
      LineageParams<ParentName<DeclarationOf<N>>, Optional>,
      Extract<
        OwnKeys<DeclarationOf<N>>,
        LineageKeys<ParentName<DeclarationOf<N>>>
      >,
      Optional
    >;

type LineageKeys<N> = [DeclarationOf<N>] extends [never]
  ? never
  : OwnKeys<DeclarationOf<N>> | LineageKeys<ParentName<DeclarationOf<N>>>;

// Core reads back the nearest declaration of a key but checks the value it takes against every one.
type WithAncestors<D, Inherited, S, Optional extends 'input' | 'output'> = [
  S,
] extends [never]
  ? OwnParams<D, Optional> & Inherited
  : Without<Inherited, S> &
      (Optional extends 'input'
        ? Without<OwnParams<D, 'input'>, S> & RedeclaredInput<D, Inherited, S>
        : Without<OwnParams<D, 'output'>, PassKeys<D, S>> &
            PassedOutput<D, PassKeys<D, S>>);

type Without<T, S> = { [K in keyof T as K extends S ? never : K]: T[K] };

// The values of `C` that `A` also accepts, member by member.
type Narrow<C, A> = C extends unknown
  ? [C] extends [A]
    ? C
    : Extract<A, C>
  : never;

// A pass-through is core's `any`, so it takes whatever its ancestors take.
type RedeclaredValue<D, Inherited, K> = Narrow<
  [PassKeys<D, K>] extends [never] ? KeyType<D, K, 'input'> : unknown,
  Exclude<Inherited[K & keyof Inherited], undefined>
>;

type FillsOwn<D, K> = K extends keyof ParamsBlock<D>
  ? FillsDefault<ParamsBlock<D>[K]>
  : false;

type HasOwnDefault<D, K> = K extends keyof ParamsBlock<D>
  ? HasDefault<ParamsBlock<D>[K]>
  : false;

type OwnDefault<D, K> = Invoked<
  DefaultOf<ParamsBlock<D>[K & keyof ParamsBlock<D>]>
>;

// Only the nearest declaration's default fills the key, and core checks it against every declaration.
type IsOptionalRedeclared<D, K> =
  HasOwnDefault<D, K> extends true
    ? LineageAccepts<OwnDefault<D, K>, DeclarationOf<ParentName<D>>, K>
    : LineageAccepts<undefined, D, K>;

type LineageAccepts<V, D, K> = [D] extends [never]
  ? true
  : (K extends OwnKeys<D> ? Accepts<V, D, K> : true) extends true
    ? LineageAccepts<V, DeclarationOf<ParentName<D>>, K>
    : false;

// `any` takes every value; an optional declaration also takes an absent or `null` one. Each member of `V` counts.
type Accepts<V, D, K> = [PassKeys<D, K>] extends [never]
  ? V extends null | undefined
    ? IsOptionalInput<D, K>
    : V extends KeyType<D, K, 'input'>
      ? true
      : false
  : true;

type RedeclaredInput<D, Inherited, S> = {
  [
    K in S & string as IsOptionalRedeclared<D, K> extends true ? never : K
  ]: RedeclaredValue<D, Inherited, K>;
} & {
  [
    K in S & string as IsOptionalRedeclared<D, K> extends true ? K : never
  ]?: RedeclaredValue<D, Inherited, K>;
};

// An untyped non-url param is core's `any`, so it keeps the value an ancestor's url decoded.
type PassKeys<D, S> =
  S extends UrlKeys<D>
    ? never
    : S extends keyof ParamsBlock<D>
      ? ParamsBlock<D>[S] extends { type: unknown }
        ? never
        : S
      : never;

type PassedOutput<D, P> = [P] extends [never]
  ? unknown
  : {
      [
        K in P & string as MayBeAbsent<D, K> extends true ? never : K
      ]: PassedValue<D, K>;
    } & {
      [
        K in P & string as MayBeAbsent<D, K> extends true ? K : never
      ]?: PassedValue<D, K>;
    };

type PassedValue<D, K> =
  | DefaultRead<D, K>
  | Wrapped<
      Exclude<UrlRead<ParentName<D>, K>, undefined>,
      IsArray<ParamsBlock<D>[K & keyof ParamsBlock<D>], K>
    >;

// A default that may return `undefined` reads back what it returns otherwise.
type DefaultRead<D, K> =
  FillsOwn<D, K> extends true
    ? KeyType<D, K, 'output'>
    : HasOwnDefault<D, K> extends true
      ? Widen<Exclude<OwnDefault<D, K>, undefined>> extends infer V
        ? V | Wrapped<V, IsArray<ParamsBlock<D>[K & keyof ParamsBlock<D>], K>>
        : never
      : never;

// Without its own default, a pass-through reads `undefined` when every declaration lets the key go unset.
type MayBeAbsent<D, K> =
  FillsOwn<D, K> extends true
    ? false
    : LineageAccepts<undefined, D, K> extends true
      ? true
      : undefined extends UrlRead<ParentName<D>, K>
        ? true
        : false;

type Wrapped<V, A> = A extends true
  ? V extends readonly unknown[]
    ? V
    : V[]
  : V;

// What the declarations above a pass-through read or take: a url one ends the walk, another adds its value.
type UrlRead<N, K> = [DeclarationOf<N>] extends [never]
  ? never
  : K extends OwnKeys<DeclarationOf<N>>
    ? K extends UrlKeys<DeclarationOf<N>>
      ? Taken<DeclarationOf<N>, K>
      : | AncestorValue<DeclarationOf<N>, K>
        | UrlRead<ParentName<DeclarationOf<N>>, K>
    : UrlRead<ParentName<DeclarationOf<N>>, K>;

// A typed non-url ancestor holds what it took; an `any` one, whatever it takes.
type AncestorValue<D, K> = [PassKeys<D, K>] extends [never]
  ? Taken<D, K>
  : Mutable<KeyType<D, K, 'input'>>;

type Mutable<V> = V extends readonly (infer E)[] ? E[] : V;

// An array param reads a scalar back unwrapped once an `any` param took it; an absent query value reads `undefined`.
type Taken<D, K> =
  | KeyType<D, K, 'output'>
  | (IsArray<
      K extends keyof ParamsBlock<D> ? ParamsBlock<D>[K] : unknown,
      K
    > extends true
      ? Extract<KeyType<D, K, 'output'>, readonly unknown[]>[number]
      : never)
  | (IsQuery<D, K> extends true ? undefined : never);

type Simplify<T> = { [K in keyof T]: T[K] };

// Core gives every state the `#` param, which also keeps a param-less state's
// object non-empty, so an undeclared key is an excess property.
type HashParam = { '#'?: string | null };

/**
 * The params a state accepts: its own and its ancestors', defaults optional.
 * A redeclared key takes only what every declaration of it accepts.
 */
export type ParamsOf<N extends StateName> = IsRegistered extends true
  ? Simplify<LineageParams<N, 'input'> & HashParam>
  : RawParams;

/**
 * The params a state reads back once active: defaults filled in, a redeclared
 * key as its nearest declaration types it. A query param
 * reads back as one value unless it declares `array: 'auto'` or `array: true`,
 * or is a `name[]` id, though core also reads an unset `array` back as an array
 * of two or more.
 */
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
 * A typed view of core's `StateService`. It is assignable both ways: core's
 * class fills a typed getter or field with no cast and emits nothing, and the
 * view passes wherever a `StateService` is expected.
 */
export interface TypedStateService extends StateService {
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
