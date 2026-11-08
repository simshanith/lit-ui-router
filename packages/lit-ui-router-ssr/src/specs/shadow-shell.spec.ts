import { LitElementRenderer } from '@lit-labs/ssr/lib/lit-element-renderer.js';
import { html, LitElement, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { requestContext } from 'lit-ui-router/context';
import type { UiView, UIRouterLit } from 'lit-ui-router/pure';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ORDER IS THE POINT: `vitest.setup.coexist.ts` installs lit's own hydrate support before `lit`, which a shadow-DOM shell needs to hydrate its declarative shadow root.
import '../register.js';

import { adoptUiViewContext } from '../adopt-context.js';
import { readHydrationSignature } from '../client.js';
import type { AdoptOutcome } from '../client.js';
import { countRetained } from '../testing.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { uiView } from './fixture.js';
import { bootAt, drain, draw, hydrateInto, serve } from './round-trip.js';

/** The application shell: the routed `<ui-view>` sits in its shadow root, as hellosolarsystem lays it out. */
class AppRoot extends LitElement {
  override render(): TemplateResult {
    return html`<header>planets</header>
      ${uiView()}`;
  }
}

customElements.define('app-root', AppRoot);

let openGate = (): void => {};

/** The same shell, holding its first update, and so the hydrate of its shadow root, until the spec opens the gate. */
class LateRoot extends AppRoot {
  static gate: Promise<void> = Promise.resolve();

  protected override async scheduleUpdate(): Promise<void> {
    await LateRoot.gate;
    await super.scheduleUpdate();
  }
}

customElements.define('late-root', LateRoot);

/** `LitElementRenderer`, narrowed to the shell, so `<ui-view>` stays with its own renderer. */
class ShellRenderer extends LitElementRenderer {
  static override matchesClass(ctor: typeof HTMLElement): boolean {
    return ctor === AppRoot || ctor === LateRoot;
  }
}

const appRoot = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}><app-root></app-root></ui-router>`;

const lateRoot = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}><late-root></late-root></ui-router>`;

/** An app's own served element, which asks the adopter for itself as it connects, as a `<ui-view>` does on its wake. */
class OwnPanel extends HTMLElement {
  readonly renderOptions = {};

  render(): typeof nothing {
    return nothing;
  }

  connectedCallback(): void {
    requestContext(this, adoptUiViewContext)?.(this);
  }
}

customElements.define('own-panel', OwnPanel);

/** Holds the late shell's hydrate until the spec opens the gate. */
const closeGate = (): void => {
  LateRoot.gate = new Promise((resolve) => {
    openGate = resolve;
  });
};

/** The late shell's view, which waits in its declarative shadow root. */
const lateView = (container: HTMLElement): UiView | null | undefined =>
  container.querySelector('late-root')?.shadowRoot?.querySelector('ui-view');

/** Every `<ui-view>` in the shell's open shadow root, nested ones included. */
const shadowViews = (container: HTMLElement): UiView[] => [
  ...(container
    .querySelector('app-root')
    ?.shadowRoot?.querySelectorAll<UiView>('ui-view') ?? []),
];

type Report = [view: Element, outcome: AdoptOutcome];

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('a <ui-view> inside the shell’s declarative shadow root', () => {
  it('signs the views the document drew, nested ones included', async () => {
    const { container } = serve(
      await draw(appRoot, [UiViewRenderer, ShellRenderer], '/shell/detail'),
    );

    expect(readHydrationSignature(container)).toMatchObject({
      views: ['$default', '$default.$default'],
    });
  });

  it('reaches onAdopt, and bootstrap resolves once it has updated', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container, stamp } = serve(
      await draw(appRoot, [UiViewRenderer, ShellRenderer], '/shell/detail'),
    );

    const received: Report[] = [];

    const result = await bootAt(container, appRoot, '/shell/detail', {
      onAdopt: (view, outcome) => received.push([view, outcome]),
    });

    const [outer, nested] = shadowViews(container);
    expect(received).toEqual([
      [outer, 'adopted'],
      [nested, 'adopted'],
    ]);
    expect(result.outcome).toBe('adopted');
    expect(Object.fromEntries(result.views)).toEqual({
      $default: { outcome: 'adopted', view: outer },
      '$default.$default': { outcome: 'adopted', view: nested },
    });

    for (const view of [outer, nested]) {
      expect(view?.hasUpdated).toBe(true);
      expect(view?.isUpdatePending).toBe(false);
    }

    expect(countRetained(stamp)).toMatchObject({ removed: 0 });
    expect(requestContext(container, adoptUiViewContext)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the adopter for views whose host hydrates after bootstrap resolves', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = serve(
      await draw(lateRoot, [UiViewRenderer, ShellRenderer], '/shell/detail'),
    );

    closeGate();
    const received: AdoptOutcome[] = [];

    const result = await bootAt(container, lateRoot, '/shell/detail', {
      onAdopt: (_view, outcome) => received.push(outcome),
    });

    expect(Object.fromEntries(result.views)).toEqual({
      $default: { outcome: 'pending' },
      '$default.$default': { outcome: 'pending' },
    });
    expect(received).toEqual([]);
    expect(requestContext(container, adoptUiViewContext)).toBeDefined();

    openGate();
    await drain(container);

    expect(received).toEqual(['adopted', 'adopted']);
    expect(
      container.querySelector('late-root')?.shadowRoot?.textContent,
    ).toContain('leaf');
    expect(requestContext(container, adoptUiViewContext)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports an element of the app’s own that asks the adopter to onAdopt, and leaves it out of views', async () => {
    const { container } = serve(
      await draw(lateRoot, [UiViewRenderer, ShellRenderer], '/shell/detail'),
    );

    closeGate();
    const received: Report[] = [];

    const result = await bootAt(container, lateRoot, '/shell/detail', {
      onAdopt: (view, outcome) => received.push([view, outcome]),
    });

    const panel = new OwnPanel();
    container.append(panel);

    expect(received).toEqual([[panel, 'none']]);

    openGate();
    await drain(container);

    expect(received.map(([, outcome]) => outcome)).toEqual([
      'none',
      'adopted',
      'adopted',
    ]);
    expect([...result.views.keys()]).toEqual(['$default', '$default.$default']);
    expect(requestContext(container, adoptUiViewContext)).toBeUndefined();
  });

  it('warns once its views have all reported, when none of them adopted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = serve(
      await draw(lateRoot, [UiViewRenderer, ShellRenderer], '/badge'),
    );

    // Everything between the served pair dropped, as a re-render that wrote an empty view leaves it.
    const view = lateView(container)!;

    const pair = [...view.childNodes].filter(
      (node) => node.nodeType === Node.COMMENT_NODE,
    );

    view.replaceChildren(pair[0], pair.at(-1)!);

    closeGate();

    const result = await bootAt(container, lateRoot, '/badge');

    expect(Object.fromEntries(result.views)).toEqual({
      $default: { outcome: 'pending' },
    });
    expect(warn).not.toHaveBeenCalled();

    openGate();
    await drain(container);

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      'none of the views it was drawn with adopted',
    );
    expect(warn.mock.calls[0]?.[1]).toEqual({ $default: 'none' });
  });

  it('adopts on its own when its host hydrates after hydrateRoot is released', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container, stamp } = serve(
      await draw(lateRoot, [UiViewRenderer, ShellRenderer], '/shell/detail'),
    );

    closeGate();
    const { release } = await hydrateInto(container, lateRoot, '/shell/detail');
    release();

    openGate();
    await drain(container);

    expect(lateView(container)?.hasUpdated).toBe(true);
    expect(
      container.querySelector('late-root')?.shadowRoot?.textContent,
    ).toContain('leaf');
    expect(countRetained(stamp)).toMatchObject({ removed: 0 });
    expect(warn).not.toHaveBeenCalled();
  });
});
