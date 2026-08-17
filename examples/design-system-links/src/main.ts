import { html, LitElement, css, render } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
} from 'lit-ui-router';
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/theme-light.js';
import '@spectrum-web-components/theme/scale-medium.js';
import '@spectrum-web-components/link/sp-link.js';

/** each demo row reads its own live `href` back out of the DOM */
type HrefRow = Ref<HTMLElement>;

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    h3 {
      margin: 0 0 4px;
    }
    p {
      margin: 0 0 16px;
      color: #4b4b4b;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: baseline;
      gap: 8px 16px;
      padding: 10px 0;
      border-top: 1px solid #e4e4e4;
    }
    .row:last-of-type {
      border-bottom: 1px solid #e4e4e4;
    }
    .opt {
      font-family: ui-monospace, monospace;
      font-size: 13px;
      color: #6b6b6b;
    }
    .href {
      font-family: ui-monospace, monospace;
      font-size: 13px;
    }
    .href.none {
      color: #9a3b3b;
    }
    sp-link.active {
      font-weight: 700;
    }
    a.active {
      font-weight: 700;
    }
    ui-view {
      display: block;
      margin-top: 20px;
    }
  `;

  private readonly rows: Record<
    'assignTrue' | 'assignAuto' | 'anchorAuto',
    HrefRow
  > = {
    assignTrue: createRef(),
    assignAuto: createRef(),
    anchorAuto: createRef(),
  };

  /** bumped whenever an observed href changes, to re-render the readouts */
  @state() private hrefTick = 0;

  private readonly observer = new MutationObserver(() => {
    this.hrefTick += 1;
  });

  firstUpdated(): void {
    for (const row of Object.values(this.rows)) {
      const el = row.value;
      if (el) {
        this.observer.observe(el, {
          attributes: true,
          attributeFilter: ['href'],
        });
      }
    }
    this.hrefTick += 1;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer.disconnect();
  }

  private readout(row: HrefRow) {
    // read through the tick so lit re-evaluates when the attribute changes
    void this.hrefTick;
    const href = row.value?.getAttribute('href') ?? null;
    return href === null
      ? html`<span class="href none">no href attribute</span>`
      : html`<span class="href">href="${href}"</span>`;
  }

  render() {
    const { assignTrue, assignAuto, anchorAuto } = this.rows;
    return html`
      <h3>uiSref and a design-system link element</h3>
      <p>
        <code>&lt;sp-link&gt;</code> declares its own <code>href</code>, but its
        tag name is not <code>a</code> — so
        <code>assignHref: 'auto'</code> refuses it and
        <code>assignHref: true</code> is what makes uiSref drive it. Every link
        below navigates; only the href differs.
      </p>

      <div class="row">
        <sp-link
          ${ref(assignTrue)}
          ${uiSref('components', {}, { assignHref: true })}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Components (sp-link)</sp-link
        >
        <span class="opt">assignHref: true</span>
        ${this.readout(assignTrue)}
      </div>

      <div class="row">
        <sp-link
          ${ref(assignAuto)}
          ${uiSref('tokens', {}, { assignHref: 'auto' })}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Tokens (sp-link)</sp-link
        >
        <span class="opt">assignHref: 'auto'</span>
        ${this.readout(assignAuto)}
      </div>

      <div class="row">
        <a
          ${ref(anchorAuto)}
          ${uiSref('tokens', {}, { assignHref: 'auto' })}
          ${uiSrefActive({ activeClasses: ['active'] })}
          >Tokens (plain a)</a
        >
        <span class="opt">assignHref: 'auto'</span>
        ${this.readout(anchorAuto)}
      </div>

      <ui-view></ui-view>
    `;
  }
}

const componentsState: LitStateDeclaration = {
  name: 'components',
  url: '/components',
  component: () =>
    html`<h4>Components</h4>
      <p>
        The first link carried a real href here, so hovering it showed the URL
        and a middle-click would have opened it in a new tab.
      </p>`,
};

const tokensState: LitStateDeclaration = {
  name: 'tokens',
  url: '/tokens',
  component: () =>
    html`<h4>Tokens</h4>
      <p>
        Both links to this state navigated on click — the option governs the
        href attribute only, never the click handler.
      </p>`,
};

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.stateRegistry.register(componentsState);
router.stateRegistry.register(tokensState);
router.urlService.rules.initial({ state: 'components' });
router.start();

render(
  html`
    <sp-theme system="spectrum" color="light" scale="medium">
      <ui-router .uiRouter=${router}>
        <app-root></app-root>
      </ui-router>
    </sp-theme>
  `,
  document.getElementById('root')!,
);
