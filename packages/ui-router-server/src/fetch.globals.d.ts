// The WinterCG fetch surface the `./fetch` adapter constructs and reads —
// `Request`, `Response`, `Headers` exist on every server runtime the package
// targets (workerd, node 18+, deno, bun) but not in the DOM-free ES2022 lib
// it compiles against (tsconfig: types []), so the adapter's source declares
// the minimal surface it touches, the `globals.d.ts` discipline applied to
// the fetch globals. Deliberately no `URL`: the adapter parses origin and
// search with string ops (as `index.ts` does for pathnames), keeping this
// shim from shadowing node's real `URL` in the test graph. The test graph's
// own node types coexist with these classes (no test constructs a fetch
// object with node-only semantics, so the shadowed structural surface here
// is never the poorer choice at a call site).

type ResponseInit = {
  status?: number;
  headers?: Headers | Record<string, string>;
};

type RequestInit = {
  method?: string;
  headers?: Headers | Record<string, string>;
};

declare class Headers {
  constructor(init?: Headers | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  delete(name: string): void;
}

declare class Request {
  // `input` accepts an absolute url string or another Request; `init` copies
  // method/headers/body from the original (a constructed Request has a
  // MUTABLE headers object, which is what lets the adapter strip validators).
  constructor(input: string | Request, init?: Request | RequestInit);
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
}

declare class Response {
  // `body` is `unknown` so a raw asset's stream body round-trips through the
  // status-relabel/Link wrapper without this shim needing a ReadableStream type.
  constructor(body?: unknown, init?: ResponseInit);
  readonly status: number;
  readonly body: unknown;
  readonly headers: Headers;
}
