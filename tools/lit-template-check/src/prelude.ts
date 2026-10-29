// Ambient helpers appended to every lowered file; `nothing` and `noChange`
// resolve from the file's own lit import, so examples check against their lit.
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

export function prelude(
  litModule: string,
  locals: LocalTag[] = [],
  events: LocalEvents[] = [],
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

  // lit's shipped DirectiveResult is an empty interface, so any object would
  // pass for one; the augmentation gives it a member a plain object lacks.
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
  type HtmlTag = keyof HTMLElementTagNameMap | keyof LocalTags | keyof UntypedTags;
  type Html<T extends string> = T extends keyof LocalTags ? LocalTags[T] : T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : HTMLElement;
  type Svg<T extends string> = T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T] : SVGElement;
  type Kebab<S extends string> = S extends \`\${infer Head}\${infer Tail}\` ? \`\${Head extends Uppercase<Head> ? Head extends Lowercase<Head> ? Head : \`-\${Lowercase<Head>}\` : Head}\${Kebab<Tail>}\` : S;
  type ExtraAttribute = 'class' | 'for' | 'http-equiv' | 'accept-charset' | 'is' | 'exportparts' | 'popovertarget' | 'popovertargetaction' | 'itemscope' | 'itemprop' | 'itemtype' | 'itemid' | 'itemref' | \`data-\${string}\` | \`aria-\${string}\`;
  type AttributeName<E> = Lowercase<Extract<keyof E, string>> | Kebab<Extract<Exclude<keyof E, keyof HTMLElement>, string>> | ExtraAttribute;
  type EventMap<E> = E extends HTMLVideoElement ? HTMLVideoElementEventMap : E extends HTMLMediaElement ? HTMLMediaElementEventMap : E extends HTMLBodyElement ? HTMLBodyElementEventMap : E extends HTMLElement ? HTMLElementEventMap : E extends SVGSVGElement ? SVGSVGElementEventMap : E extends SVGElement ? SVGElementEventMap : ElementEventMap;
  // method syntax keeps the parameter bivariant, as lit-analyzer never checks it at all
  type Listener<Ev> = { bivariant(event: Ev): unknown }['bivariant'] | { handleEvent(event: Ev): unknown };
  function tag(name: HtmlTag): void;
  function svgTag(name: keyof SVGElementTagNameMap): void;
  function el<T extends string>(): Html<T> & { readonly __ltcTag?: T };
  function svgEl<T extends string>(): Svg<T>;
  function attr<E>(el: E, name: NoInfer<AttributeName<E>>): void;
  function value(value: string | number | bigint | boolean | Special): void;
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
