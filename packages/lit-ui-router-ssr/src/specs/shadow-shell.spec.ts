import { LitElementRenderer } from '@lit-labs/ssr/lib/lit-element-renderer.js';
import { html, LitElement } from 'lit';
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
import { bootAt, drain, draw, serve } from './round-trip.js';

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

    LateRoot.gate = new Promise((resolve) => {
      openGate = resolve;
    });
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
});
