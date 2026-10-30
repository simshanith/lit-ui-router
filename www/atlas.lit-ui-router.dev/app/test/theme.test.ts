// The pre-paint script and the module's readTheme + applyTheme land on the same
// data-theme for every stored value and every host stamp.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTheme, prepaintScript, readTheme, THEME_KEY } from '../src/theme.ts';

const BLOCKED = Symbol('blocked');
type Stored = string | null | typeof BLOCKED;
type Stamped = 'light' | 'dark' | null;

/** A root with one attribute map and a storage that may throw, as a private window's does. */
function fakeDom(stored: Stored, stamped: Stamped) {
  const attrs = new Map<string, string>();
  if (stamped !== null) attrs.set('data-theme', stamped);
  const documentElement = {
    getAttribute: (name: string): string | null => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string): void => {
      attrs.set(name, value);
    },
    removeAttribute: (name: string): void => {
      attrs.delete(name);
    },
  };
  const localStorage = {
    getItem: (key: string): string | null => {
      if (stored === BLOCKED) throw new Error('blocked');
      return key === THEME_KEY ? stored : null;
    },
    setItem: (): void => {
      if (stored === BLOCKED) throw new Error('blocked');
    },
  };
  return { document: { documentElement }, localStorage, theme: () => attrs.get('data-theme') ?? null };
}

const runInline = (dom: ReturnType<typeof fakeDom>): void => {
  // Only document and localStorage are in scope: any other name the script reads throws here.
  new Function('document', 'localStorage', prepaintScript())(dom.document, dom.localStorage);
};

const runModule = (dom: ReturnType<typeof fakeDom>): void => {
  Object.defineProperty(globalThis, 'document', { value: dom.document, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: dom.localStorage, configurable: true, writable: true });
  applyTheme(readTheme());
};

const STORED: Stored[] = [null, 'light', 'dark', 'auto', 'sepia', BLOCKED];
const STAMPED: Stamped[] = [null, 'light', 'dark'];

test('the inline script is the function applied to the one key', () => {
  assert.match(prepaintScript(), /^\(function prepaintTheme\(key\s*\)\s*\{[\s\S]*\}\)\("atlas-theme"\)$/);
});

for (const stored of STORED) {
  for (const stamped of STAMPED) {
    test(`stored ${String(stored)} on a root stamped ${stamped ?? 'bare'}`, () => {
      const inline = fakeDom(stored, stamped);
      runInline(inline);
      const module = fakeDom(stored, stamped);
      runModule(module);
      assert.equal(inline.theme(), module.theme());
    });
  }
}
