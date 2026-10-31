import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';

import {
  BOOT_EVENT,
  INPUT_ID,
  prePaintScript,
  prePaintSource,
  QUERY_MARK,
  STORAGE_KEY,
  TYPED_MARK,
} from '../src/pre-paint.ts';

type Listener = () => void;

class Events {
  readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

class FakeInput extends Events {
  value = '';
  focused = false;
  readonly attributes = new Set<string>();

  focus(): void {
    this.focused = true;
  }

  setSelectionRange(): void {}

  setAttribute(name: string): void {
    this.attributes.add(name);
  }
}

interface Page {
  input: FakeInput;
  marks: Set<string>;
  location: { href: string };
  document: Events;
}

interface Visit {
  url?: string;
  stored?: string | null;
  storage?: 'refused';
  typed?: string;
}

const SCRIPT = /^<script>([\s\S]*)<\/script>$/;

const source = (): string => {
  const match = SCRIPT.exec(prePaintScript());
  assert.ok(match, 'one classic script element');

  return match[1];
};

/** Runs the inlined script with these globals and nothing else: a free name it does not list throws. */
const visit = ({
  url = 'https://lit-ui-router.dev/domain-search',
  stored = null,
  storage,
  typed = '',
}: Visit = {}): Page => {
  const input = new FakeInput();
  input.value = typed;
  const marks = new Set<string>();
  const location = { href: url };

  const document = Object.assign(new Events(), {
    getElementById: (id: string) => (id === INPUT_ID ? input : null),
    documentElement: {
      toggleAttribute: (name: string, on: boolean) =>
        on ? marks.add(name) : marks.delete(name),
    },
  });

  runInNewContext(source(), {
    document,
    location,
    URL,
    HTMLInputElement: FakeInput,
    history: {
      state: null,
      replaceState: (_state: null, _title: string, next: URL) => {
        location.href = String(next);
      },
    },
    localStorage: {
      getItem: (key: string) => {
        if (storage === 'refused') throw new Error('SecurityError');

        return key === STORAGE_KEY ? stored : null;
      },
    },
  });

  return { input, marks, location, document };
};

const queryOf = (page: Page): string | null =>
  new URL(page.location.href).searchParams.get('q');

describe('the pre-paint script', () => {
  it('compiles in an empty scope', () => {
    assert.doesNotThrow(() => runInNewContext(`(${prePaintSource()})`, {}));
  });

  it('fills the input from ?q=, focuses it, and marks the query present', () => {
    const page = visit({
      url: 'https://lit-ui-router.dev/domain-search?q=lit',
    });

    assert.equal(page.input.value, 'lit');
    assert.ok(page.input.focused);
    assert.ok(page.marks.has(QUERY_MARK));
  });

  it('prefers ?q= to the last search', () => {
    const page = visit({
      url: 'https://lit-ui-router.dev/domain-search?q=lit',
      stored: 'older',
    });

    assert.equal(page.input.value, 'lit');
  });

  it('fills the input from the last search without marking a query', () => {
    const page = visit({ stored: 'older' });

    assert.equal(page.input.value, 'older');
    assert.ok(!page.marks.has(QUERY_MARK));
    assert.equal(queryOf(page), null);
  });

  it('fills nothing when storage is refused', () => {
    const page = visit({ storage: 'refused' });

    assert.equal(page.input.value, '');
    assert.ok(page.input.focused);
  });

  it('keeps and syncs text typed before it ran', () => {
    const page = visit({
      url: 'https://lit-ui-router.dev/domain-search?q=drawn',
      typed: 'mine',
    });

    assert.equal(page.input.value, 'mine');
    assert.equal(queryOf(page), 'mine');
    assert.ok(page.input.attributes.has(TYPED_MARK));
  });

  it('syncs typing into the url until the app boots', () => {
    const page = visit();

    page.input.value = 'ui';
    page.input.dispatch('input');
    assert.equal(queryOf(page), 'ui');
    assert.ok(page.marks.has(QUERY_MARK));

    page.input.value = '';
    page.input.dispatch('input');
    assert.equal(queryOf(page), null);
    assert.ok(!page.marks.has(QUERY_MARK));

    page.document.dispatch(BOOT_EVENT);
    page.input.value = 'after';
    page.input.dispatch('input');
    assert.equal(queryOf(page), null);
  });
});
