import { LitElement } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { countRetained, stampServed } from '../testing.js';

/** A component that draws into its render root after its first update, as a canvas does. */
class DrawingBoard extends LitElement {
  override firstUpdated(): void {
    this.renderRoot.append(document.createElement('canvas'));
  }
}

customElements.define('drawing-board', DrawingBoard);

const served = (markup: string): HTMLElement => {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = markup;

  return container;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('stampServed', () => {
  it('stamps every element under the root, not the root itself', () => {
    const container = served('<main><h1>title</h1><p><a>link</a></p></main>');

    const stamp = stampServed(container);

    expect(stamp.served).toBe(4);
    expect(stamp.elements.map((element) => element.localName)).toEqual([
      'main',
      'h1',
      'p',
      'a',
    ]);
  });

  it('descends into open shadow roots', () => {
    const container = served('<section><span></span></section>');

    const shadow = container.querySelector('section')!.attachShadow({
      mode: 'open',
    });

    shadow.innerHTML = '<p><b>inside</b></p>';

    expect(stampServed(container).served).toBe(4);
  });
});

describe('countRetained', () => {
  it('retains every element a boot left alone', () => {
    const container = served('<main><h1>title</h1><p>body</p></main>');
    const stamp = stampServed(container);

    container.querySelector('h1')!.textContent = 'hydrated';

    expect(countRetained(stamp)).toEqual({
      served: 3,
      retained: 3,
      removed: 0,
      added: 0,
    });
  });

  it('counts removed and added elements', () => {
    const container = served('<main><h1>title</h1><p>body</p></main>');
    const stamp = stampServed(container);

    container.querySelector('p')!.remove();
    container.querySelector('main')!.append(document.createElement('footer'));
    container.querySelector('main')!.append(document.createElement('aside'));

    expect(countRetained(stamp)).toEqual({
      served: 3,
      retained: 2,
      removed: 1,
      added: 2,
    });
  });

  it('counts a re-rendered view as removed and added', () => {
    const container = served(
      '<ui-view><article><h2>leaf</h2><p>body</p></article></ui-view>',
    );

    const stamp = stampServed(container);

    container.querySelector('ui-view')!.innerHTML =
      '<article><h2>leaf</h2><p>body</p></article>';

    expect(countRetained(stamp)).toEqual({
      served: 4,
      retained: 1,
      removed: 3,
      added: 3,
    });
  });

  it('counts what a component draws in firstUpdated as added', async () => {
    const container = served('<main><drawing-board></drawing-board></main>');
    const stamp = stampServed(container);
    const board = container.querySelector<DrawingBoard>('drawing-board')!;

    await board.updateComplete;

    expect(board.shadowRoot?.querySelector('canvas')).not.toBeNull();
    expect(countRetained(stamp)).toEqual({
      served: 2,
      retained: 2,
      removed: 0,
      added: 1,
    });
  });
});

/** Evaluates `fn`'s source text in the global scope, as a page script would. */
const fromSource = <T>(fn: T): T =>
  // SAFETY: a self-contained function's source evaluates back to the same function.
  // oxlint-disable-next-line typescript/no-implied-eval -- the spec is that the source text alone evaluates
  new Function(`return ${String(fn)}`)() as T;

describe('serialised into a page', () => {
  it('runs from its source text alone, with no module scope', () => {
    const stamp = fromSource(stampServed);
    const count = fromSource(countRetained);
    const container = served('<main><h1>title</h1><p>body</p></main>');

    const stamped = stamp(container);
    container.querySelector('p')!.remove();

    expect(count(stamped)).toEqual({
      served: 3,
      retained: 2,
      removed: 1,
      added: 0,
    });
  });
});
