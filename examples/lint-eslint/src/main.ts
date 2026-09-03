import { hashLocationPlugin } from '@uirouter/core';
import { css, html, LitElement, render } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  LitStateDeclaration,
  UIRouterLit,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';
import { EslintHtmlView, LintReportView } from './report-views.js';

// Positive control: delete `${uiSref('eslint-html')}` from the second tab and
// the panel reports lit-ui-router/anchor-is-valid on it — while the tab stops
// navigating, which is the reason the rule exists.
@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    nav {
      display: flex;
      gap: 4px;
    }
    nav a {
      font-size: 13px;
      padding: 6px 12px;
      border: 1px solid #d0d0d0;
      border-radius: 4px 4px 0 0;
      border-bottom: 0;
      background: #f6f6f6;
      color: #333;
      text-decoration: none;
      cursor: pointer;
    }
    nav a.active {
      background: #fff;
      font-weight: 600;
    }
  `;

  render() {
    return html`
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('report')}
          >Report</a
        >
        <a
          ${uiSrefActive({ activeClasses: ['active'] })}
          ${uiSref('eslint-html')}
          >ESLint html</a
        >
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// The two views of one lint run are the two states: the hash picks the panel.
const reportState: LitStateDeclaration = {
  name: 'report',
  url: '/report',
  component: LintReportView,
};

const htmlState: LitStateDeclaration = {
  name: 'eslint-html',
  url: '/eslint-html',
  component: EslintHtmlView,
};

const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.stateRegistry.register(reportState);
router.stateRegistry.register(htmlState);
router.urlService.rules.initial({ state: 'report' });
router.start();

render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root')!,
);
