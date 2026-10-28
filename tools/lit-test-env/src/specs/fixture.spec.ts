import { afterEach, describe, expect, it } from 'vitest';
import {
  fixture,
  fixtureCleanup,
  fixtureSync,
  oneEvent,
  type FixtureRender,
} from '../fixture.ts';

afterEach(fixtureCleanup);

/** Stands in for lit's `render`: writes markup into the container. */
const renderMarkup: FixtureRender = (value, container) => {
  container.innerHTML = String(value);
};

class UpdatingElement extends HTMLElement {
  updated = false;
  get updateComplete(): Promise<boolean> {
    return Promise.resolve().then(() => (this.updated = true));
  }
}

customElements.define('fixture-updating', UpdatingElement);

describe('fixtureSync', () => {
  it('mounts a node in a wrapper on document.body and returns it', () => {
    const node = document.createElement('span');

    const element = fixtureSync(node);

    expect(element).toBe(node);
    expect(element.isConnected).toBe(true);
    expect(element.parentElement?.parentElement).toBe(document.body);
  });

  it('returns the first element of a fragment', () => {
    const fragment = document.createDocumentFragment();
    fragment.append('text', document.createElement('b'));

    expect(fixtureSync(fragment).tagName).toBe('B');
  });

  it('renders a template through options.render', () => {
    const element = fixtureSync('<!--x--> <p id="rendered"></p>', {
      render: renderMarkup,
    });

    expect(element.id).toBe('rendered');
    expect(element.isConnected).toBe(true);
  });

  it('rejects a non-node template without a render', () => {
    expect(() => fixtureSync('<p></p>')).toThrow(TypeError);
  });

  it('rejects a template that renders no element', () => {
    expect(() => fixtureSync('text', { render: renderMarkup })).toThrow(
      /no element/,
    );
  });

  it('connects the parent before the content it wraps', () => {
    const order: string[] = [];
    customElements.define(
      'fixture-order-parent',
      class extends HTMLElement {
        connectedCallback() {
          order.push('parent');
        }
      },
    );
    customElements.define(
      'fixture-order-child',
      class extends HTMLElement {
        connectedCallback() {
          order.push('child');
        }
      },
    );
    const parent = document.createElement('fixture-order-parent');

    const child = fixtureSync(document.createElement('fixture-order-child'), {
      parent,
    });

    expect(child.parentElement).toBe(parent);
    expect(order).toEqual(['parent', 'child']);
  });
});

describe('fixture', () => {
  it('awaits updateComplete on the element and the parent', async () => {
    const parent = document.createElement('div');
    let parentUpdated = false;
    Object.defineProperty(parent, 'updateComplete', {
      get: () => Promise.resolve().then(() => (parentUpdated = true)),
    });

    const element = await fixture(new UpdatingElement(), { parent });

    expect(element.updated).toBe(true);
    expect(parentUpdated).toBe(true);
  });

  it('resolves for an element without updateComplete', async () => {
    const element = await fixture(document.createElement('div'));

    expect(element.isConnected).toBe(true);
  });
});

describe('fixtureCleanup', () => {
  it('removes every wrapper, tolerating one already removed', () => {
    const first = fixtureSync(document.createElement('i'));
    const second = fixtureSync(document.createElement('i'));
    second.parentElement?.remove();

    fixtureCleanup();

    expect(first.isConnected).toBe(false);
    expect(document.body.children).toHaveLength(0);
  });
});

describe('oneEvent', () => {
  it('resolves with the first event', async () => {
    const target = new EventTarget();
    const first = new Event('ping');

    const received = oneEvent(target, 'ping');
    target.dispatchEvent(first);
    target.dispatchEvent(new Event('ping'));

    await expect(received).resolves.toBe(first);
  });

  it('resolves once for an event that bubbles through the target', async () => {
    const parent = fixtureSync(document.createElement('div'));
    const child = parent.appendChild(document.createElement('span'));
    const event = new CustomEvent('ping', { bubbles: true, detail: 1 });

    const received = oneEvent<CustomEvent<number>>(parent, 'ping');
    child.dispatchEvent(event);

    expect((await received).detail).toBe(1);
  });
});
