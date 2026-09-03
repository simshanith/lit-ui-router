import { hashLocationPlugin } from '@uirouter/core';
import { html, LitElement, render } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  LitStateDeclaration,
  UIRouterLit,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';
import lintReport, {
  html as lintHtml,
  type LintReport,
} from 'virtual:lint-report';
import './lint-report.js';

// Positive control: delete `${uiSref('about')}` from the second anchor and the
// panel below reports lit-ui-router/anchor-is-valid on it.
@customElement('app-root')
export class AppRoot extends LitElement {
  render() {
    return html`
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}
          >Hello</a
        >
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('about')}
          >About</a
        >
      </nav>
      <ui-view></ui-view>
    `;
  }
}

const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: () => html`<h3>Hello World!</h3>`,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: () => html`<h3>About</h3>`,
};

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.stateRegistry.register(helloState);
router.stateRegistry.register(aboutState);
router.urlService.rules.initial({ state: 'hello' });
router.start();

let report: LintReport = lintReport;
let reportHtml = lintHtml;
let tab: 'panel' | 'html' = 'panel';

const selectTab = (next: typeof tab) => () => {
  tab = next;
  renderApp();
};

// one template factory, so re-rendering reuses the directive instances
const renderApp = () =>
  render(
    html`
      <ui-router .uiRouter=${router}>
        <app-root></app-root>
      </ui-router>
      <div class="tabs">
        <button
          class=${tab === 'panel' ? 'selected' : ''}
          @click=${selectTab('panel')}
        >
          Report
        </button>
        <button
          class=${tab === 'html' ? 'selected' : ''}
          @click=${selectTab('html')}
        >
          ESLint html
        </button>
      </div>
      <lint-report
        ?hidden=${tab !== 'panel'}
        .results=${report.results}
        .ruleDocs=${report.ruleDocs}
      ></lint-report>
      <iframe
        ?hidden=${tab !== 'html'}
        title="ESLint html formatter"
        sandbox="allow-same-origin"
        srcdoc=${reportHtml}
      ></iframe>
    `,
    document.getElementById('root')!,
  );

renderApp();

// re-render in place when the dev server re-lints, instead of reloading
if (import.meta.hot) {
  import.meta.hot.accept('virtual:lint-report', (mod) => {
    if (!mod) return;
    report = mod.default as LintReport;
    reportHtml = mod.html as string;
    renderApp();
  });
}
