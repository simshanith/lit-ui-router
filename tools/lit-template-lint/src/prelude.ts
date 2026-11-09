// Ambient helpers appended to every lowered file, typed against the file's own lit import.
export const PRELUDE_NAMESPACE = '__ltc';

/** A tag defined in the program; `type` is valid at file end, or absent if no type can name the class. */
export interface LocalTag {
  tag: string;
  type?: string;
}

/** Event names an element's class is known to dispatch. */
export interface LocalEvents {
  tag: string;
  names: string[];
}

/** An element's decorated properties and the attributes lit observes for them. */
export interface LocalAttributes {
  tag: string;
  properties: string[];
  /** `[attribute, property]` pairs. */
  attributes: [string, string][];
}

const union = (names: string[]) =>
  names.length > 0
    ? names.map((name) => JSON.stringify(name)).join(' | ')
    : 'never';

export function prelude(
  litModule: string,
  locals: LocalTag[] = [],
  events: LocalEvents[] = [],
  attributes: LocalAttributes[] = [],
): string {
  const lit = JSON.stringify(litModule);
  const directive = JSON.stringify(`${litModule}/directive.js`);
  const typed = new Map<string, string>();
  const untyped = new Set<string>();

  for (const { tag, type } of locals) {
    if (type === undefined) untyped.add(tag);
    else if (!typed.has(tag)) typed.set(tag, type);
  }

  for (const tag of typed.keys()) untyped.delete(tag);

  const localTags = [...typed]
    .map(([tag, type]) => `${JSON.stringify(tag)}: ${type};`)
    .join(' ');

  const untypedTags = [...untyped]
    .map((tag) => `${JSON.stringify(tag)}: HTMLElement;`)
    .join(' ');

  const localEvents = events
    .map(
      ({ tag, names }) =>
        `${JSON.stringify(tag)}: { ${names.map((name) => `${JSON.stringify(name)}: Event;`).join(' ')} };`,
    )
    .join(' ');

  const localAttributes = attributes
    .map(
      ({ tag, properties, attributes: pairs }) =>
        `${JSON.stringify(tag)}: { properties: ${union(properties)}; attributes: { ${pairs.map(([attribute, property]) => `${JSON.stringify(attribute)}: ${JSON.stringify(property)};`).join(' ')} } };`,
    )
    .join(' ');

  // lit's DirectiveResult is an empty interface; the augmentation keeps plain objects out.
  return `
declare module ${directive} {
  interface DirectiveResult<C extends import(${directive}).DirectiveClass = import(${directive}).DirectiveClass> { readonly __ltcDirective: C }
}
declare namespace ${PRELUDE_NAMESPACE} {
  type Nothing = typeof import(${lit}).nothing;
  type NoChange = typeof import(${lit}).noChange;
  type DirectiveResult = import(${directive}).DirectiveResult;
  type Special = Nothing | NoChange | DirectiveResult;
  interface LocalTags { ${localTags} }
  interface UntypedTags { ${untypedTags} }
  interface LocalEvents { ${localEvents} }
  interface LocalAttributes { ${localAttributes} }
  type HtmlTag = keyof HTMLElementTagNameMap | keyof LocalTags | keyof UntypedTags;
  type Html<T extends string> = T extends keyof LocalTags ? LocalTags[T] : T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : HTMLElement;
  type Svg<T extends string> = T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T] : SVGElement;
  type Kebab<S extends string> = S extends \`\${infer Head}\${infer Tail}\` ? \`\${Head extends Uppercase<Head> ? Head extends Lowercase<Head> ? Head : \`-\${Lowercase<Head>}\` : Head}\${Kebab<Tail>}\` : S;
  type ExtraAttribute = 'class' | 'for' | 'http-equiv' | 'accept-charset' | 'is' | 'exportparts' | 'popovertarget' | 'popovertargetaction' | 'itemscope' | 'itemprop' | 'itemtype' | 'itemid' | 'itemref' | \`data-\${string}\` | \`aria-\${string}\`;
  type Decorated<E> = TagOf<E> extends keyof LocalAttributes ? LocalAttributes[TagOf<E>] : { properties: never; attributes: {} };
  // a decorated property answers only to the attribute lit observes for it
  type Undecorated<E> = Extract<Exclude<keyof E, Exclude<Decorated<E>['properties'], keyof HTMLElement>>, string>;
  type AttributeName<E> = Lowercase<Undecorated<E>> | Kebab<Exclude<Undecorated<E>, keyof HTMLElement>> | Extract<keyof Decorated<E>['attributes'], string> | ExtraAttribute;
  type EventMap<E> = E extends HTMLVideoElement ? HTMLVideoElementEventMap : E extends HTMLMediaElement ? HTMLMediaElementEventMap : E extends HTMLBodyElement ? HTMLBodyElementEventMap : E extends HTMLElement ? HTMLElementEventMap : E extends SVGSVGElement ? SVGSVGElementEventMap : E extends SVGElement ? SVGElementEventMap : ElementEventMap;
  // method syntax keeps the parameter bivariant, as lit-analyzer never checks it at all
  type Listener<Ev> = { bivariant(event: Ev): unknown }['bivariant'] | { handleEvent(event: Ev): unknown };
  function tag(name: HtmlTag): void;
  function svgTag(name: keyof SVGElementTagNameMap): void;
  function el<T extends string>(): Html<T> & { readonly __ltcTag?: T };
  function svgEl<T extends string>(): Svg<T>;
  function attr<E>(el: E, name: NoInfer<AttributeName<E>>): void;
  // attribute values follow lit-analyzer's string coercion of booleans and numbers
  type IsAny<T> = 0 extends 1 & T ? true : false;
  interface Tokens<U extends string> { readonly __ltcTokens: U }
  type Split<S extends string> = S extends \`\${infer Head} \${infer Tail}\` ? Head | Split<Tail> : S;
  type Plain<A, V> = [V] extends [A] ? true : false;
  type Coerced<A, V> = [A] extends [Tokens<infer U>] ? (V extends string ? (string extends V ? false : Plain<U, Exclude<Split<V>, ''>>) : false)
    : V extends boolean ? Plain<A, \`\${V}\`>
    : V extends number ? (number extends V ? (string extends A ? true : Plain<A, V>) : Plain<A, \`\${V}\`> extends true ? true : Plain<A, V>)
    : V extends '' ? (true extends A ? true : 0 extends A ? true : Plain<A, V>)
    : V extends \`\${infer N extends number}\` ? (Plain<A, N> extends true ? true : Plain<A, V>)
    : Plain<A, V>;
  type Fits<A, V> = IsAny<V> extends true ? true : IsAny<A> extends true ? true : unknown extends A ? true : V extends null | undefined | Special ? true : V extends object ? true : Coerced<A, V>;
  type Check<A, V> = false extends Fits<A, V> ? { expected: A; got: V } : true;
  type OwnAttributes<E> = { [K in Exclude<Undecorated<E>, keyof HTMLElement | '__ltcTag'> as Lowercase<K> | Kebab<K>]: E[K] } & { [A in keyof Decorated<E>['attributes']]: E[Extract<Decorated<E>['attributes'][A], keyof E>] };
  // a custom element's own property types its attribute, as lit-analyzer reads @property
  type Target<E, N extends string, F> = TagOf<E> extends \`\${string}-\${string}\` ? (OwnAttributes<E> extends infer O ? (N extends keyof O ? O[N] : F) : F) : F;
  function as<T>(): T;
  const text: string;
  function primitive(value: string | number | bigint | boolean | Special): void;
  function value<E, N extends string, V extends string | number | bigint | boolean | Special, F = unknown>(el: E, name: N, value: V, ok: NoInfer<Check<Target<E, N, F>, V>>, fallback?: F): void;
  function valueOf<E, N extends string, V, F = unknown>(el: E, name: N, value: V, ok: NoInfer<Check<Target<E, N, F>, V>>, fallback?: F): void;
  function present<E, N extends string, F = unknown>(el: E, name: N, ok: NoInfer<IsAny<Target<E, N, F>> extends true ? true : unknown extends Target<E, N, F> ? true : Plain<Target<E, N, F>, true> extends true ? true : { expected: Target<E, N, F>; got: true }>, fallback?: F): void;
  function live<V>(value: V, ok: [V] extends [string] ? true : "If you use the 'live' directive in an attribute binding, make sure that only strings are passed in, or the binding will update every render"): void;
  function report<M extends string>(ok: M): void;
  type KindOf<T> = ([T] extends [string] ? 'String' : never) | ([T] extends [number] ? 'Number' : never) | ([T] extends [boolean] ? 'Boolean' : never) | ([T] extends [readonly unknown[]] ? 'Array' : [T] extends [(...args: never) => unknown] ? never : [T] extends [object] ? 'Object' : never);
  type Missing<K extends string> = \`'{type: \${K}}'\${K extends 'Array' | 'Object' ? " or '{attribute: false}'" : ''}\`;
  type PropertyCheck<K extends string, N extends string, T> = IsAny<T> extends true ? true : [T] extends [never] ? true
    : K extends 'none' ? ([T] extends [string] ? true : [KindOf<T>] extends [never] ? \`The built in converter doesn't handle the type of '\${N}'. Add '{attribute: false}' to its @property decorator\` : \`Missing \${Missing<KindOf<T>>} on @property decorator for '\${N}'\`)
    : K extends KindOf<T> ? true
    : [KindOf<T>] extends [never] ? (K extends 'Object' ? true : \`@property type '\${K}' is not assignable to the type of '\${N}'\`)
    : \`@property type should be '\${KindOf<T>}' instead of '\${K}'\`;
  function propertyType<K extends string, N extends string, T>(kind: K, name: N, value: T, ok: NoInfer<PropertyCheck<K, N, NonNullable<T>>>): void;
  function bool<E>(el: E, name: NoInfer<AttributeName<E>>, value: boolean | null | undefined | Special): void;
  function prop<E, K extends keyof E>(el: E, name: K, value: E[K] | Special): void;
  type TagOf<E> = E extends { readonly __ltcTag?: infer T } ? Extract<T, string> : never;
  type Events<E> = EventMap<E> & (TagOf<E> extends keyof LocalEvents ? LocalEvents[TagOf<E>] : {});
  function on<E, K extends keyof Events<E>>(el: E, type: K, listener: Listener<Events<E>[K]> | null | undefined | Nothing | DirectiveResult): void;
  function element(value: DirectiveResult | Nothing | NoChange | null | undefined): void;
  function child(value: unknown): void;
}
`;
}
