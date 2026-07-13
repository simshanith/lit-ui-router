// The runtime-neutrality shims: setTimeout and URLSearchParams exist on
// every target runtime (worker, node, browser) but not in the DOM-free
// ES2022 lib this package compiles against (tsconfig: types []), so the
// src graph declares the minimal surface it uses. The test graph's real
// node types coexist with these (node guards its globals declarations).
declare function setTimeout(handler: () => void, ms: number): unknown;

declare class URLSearchParams {
  constructor(init?: string);
  has(name: string): boolean;
  append(name: string, value: string): void;
  getAll(name: string): string[];
  forEach(callback: (value: string, key: string) => void): void;
  toString(): string;
}
