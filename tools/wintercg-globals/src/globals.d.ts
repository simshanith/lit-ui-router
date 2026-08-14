// setTimeout and URLSearchParams exist on every target runtime (worker,
// node, browser) but not in the DOM-free ES2022 lib a runtime-neutral src
// graph compiles against, so this declares the minimal surface such a graph
// uses. Opt in through tsconfig `types`, never a `/// <reference>`: only a
// config-level opt-in can be withdrawn per program, which is what the
// runtime-globals drift guard needs.
declare function setTimeout(handler: () => void, ms: number): unknown;

declare class URLSearchParams {
  constructor(init?: string);
  has(name: string): boolean;
  append(name: string, value: string): void;
  getAll(name: string): string[];
  forEach(callback: (value: string, key: string) => void): void;
  toString(): string;
}
