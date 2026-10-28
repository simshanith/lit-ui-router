// The one console method dev-warn.ts calls, absent from the DOM-free ES2022 lib
// this graph compiles against. It merges with node's Console in the test graph,
// and tsconfig.runtime-globals.json withdraws it as it does fetch.globals.d.ts,
// so node's real console checks the same call site there.

interface Console {
  warn(message: string): void;
}

// oxlint-disable-next-line no-var -- merges with node's own `var console` in the test graph
declare var console: Console;
