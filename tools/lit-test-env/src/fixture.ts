/**
 * Spec fixtures adapted from `@open-wc/testing-helpers` 3.0.1
 * (MIT, Copyright (c) 2018 open-wc): `fixture`, `fixtureSync`,
 * `fixtureCleanup` and `oneEvent`.
 *
 * Two departures from upstream:
 * - Cleanup is registered explicitly. Each consumer calls
 *   `afterEach(fixtureCleanup)` from its vitest.setup*.ts; nothing here sniffs
 *   for mocha globals.
 * - lit's `render` is passed in through `options.render` (upstream's own
 *   option), never imported: the lit2-compat alias resolves `lit` per
 *   consuming package, which an import issued from here would bypass.
 */
import { appendParentFirst } from '@tools/happy-dom/append.ts';

/** lit's `render`, or anything that renders a value into a container. */
export type FixtureRender = (value: unknown, container: HTMLElement) => unknown;

export interface FixtureOptions {
  /** Renders a non-Node template (a lit `TemplateResult`). */
  render?: FixtureRender;
  /**
   * Connected before the fixture content is appended into it, such as a
   * `<ui-router>` its descendants seek on connect.
   */
  parent?: Element;
}

const wrappers: HTMLElement[] = [];

function contentNodes(template: unknown, render?: FixtureRender): Node[] {
  if (render) {
    const scratch = document.createElement('div');
    render(template, scratch);

    return [...scratch.childNodes];
  }

  if (template instanceof DocumentFragment) {
    return [...template.childNodes];
  }

  if (template instanceof Node) {
    return [template];
  }

  throw new TypeError(
    'fixture: pass a Node, or a template with options.render',
  );
}

/**
 * Mounts `template` into a fresh wrapper appended to `document.body`
 * (inside `options.parent` when given) and returns its first element.
 */
export function fixtureSync<T extends Element>(
  template: T,
  options?: FixtureOptions,
): T;
export function fixtureSync(
  template: unknown,
  options?: FixtureOptions,
): Element;
export function fixtureSync(
  template: unknown,
  options: FixtureOptions = {},
): Element {
  const nodes = contentNodes(template, options.render);
  const wrapper = document.createElement('div');
  document.body.appendChild(wrapper);
  wrappers.push(wrapper);

  if (options.parent) {
    appendParentFirst(wrapper, options.parent, ...nodes);
  } else {
    wrapper.append(...nodes);
  }

  const element = nodes.find((node) => node instanceof Element);

  if (!element) {
    throw new TypeError('fixture: the template rendered no element');
  }

  return element;
}

async function updated(element: Element): Promise<void> {
  const { updateComplete } = element as { updateComplete?: unknown };

  if (updateComplete instanceof Promise) {
    await updateComplete;
  }
}

/**
 * {@link fixtureSync}, then awaits `updateComplete` on the parent and the
 * element, where they have one.
 */
export function fixture<T extends Element>(
  template: T,
  options?: FixtureOptions,
): Promise<T>;
export function fixture(
  template: unknown,
  options?: FixtureOptions,
): Promise<Element>;
export async function fixture(
  template: unknown,
  options: FixtureOptions = {},
): Promise<Element> {
  const element = fixtureSync(template, options);

  if (options.parent) {
    await updated(options.parent);
  }

  await updated(element);

  return element;
}

/** Removes every wrapper the fixtures above appended. */
export function fixtureCleanup(): void {
  for (const wrapper of wrappers.splice(0)) {
    wrapper.remove();
  }
}

/** Resolves with the next `type` event `target` receives. */
export function oneEvent<E extends Event = Event>(
  target: EventTarget,
  type: string,
): Promise<E> {
  return new Promise((resolve) => {
    target.addEventListener(type, (event) => resolve(event as E), {
      once: true,
    });
  });
}
