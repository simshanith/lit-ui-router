import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import lintReport, {
  html as lintHtml,
  type LintReport,
} from 'virtual:lint-report';
import './lint-report.js';

let report: LintReport = lintReport;
let reportHtml = lintHtml;

/** Connected views, so an HMR re-lint can push new results into them. */
const live = new Set<LitElement>();

/** Base for the routed views: each renders whatever the last lint run said. */
abstract class ReportView extends LitElement {
  connectedCallback() {
    super.connectedCallback();
    live.add(this);
  }

  disconnectedCallback() {
    live.delete(this);
    super.disconnectedCallback();
  }
}

/** The `report` state: our own panel over the ESLint result shape. */
@customElement('lint-report-view')
export class LintReportView extends ReportView {
  static styles = css`
    lint-report {
      margin-top: 0;
      border-top-left-radius: 0;
    }
  `;

  render() {
    return html`<lint-report
      .results=${report.results}
      .ruleDocs=${report.ruleDocs}
    ></lint-report>`;
  }
}

/** The `eslint-html` state: ESLint's own formatter, same results. */
@customElement('eslint-html-view')
export class EslintHtmlView extends ReportView {
  static styles = css`
    /* ESLint's html formatter emits a light-only document with hardcoded
       colors, so pin the frame light rather than let the browser force it */
    iframe {
      color-scheme: light;
      display: block;
      width: 100%;
      height: 420px;
      border: 1px solid light-dark(#d0d0d0, #30363d);
      border-radius: 0 6px 6px 6px;
      background: #fff;
    }
  `;

  render() {
    return html`<iframe
      title="ESLint html formatter"
      srcdoc=${reportHtml}
    ></iframe>`;
  }
}

// re-render in place when the dev server re-lints, instead of reloading
if (import.meta.hot) {
  import.meta.hot.accept('virtual:lint-report', (mod) => {
    if (!mod) return;
    report = mod.default as LintReport;
    reportHtml = mod.html as string;
    for (const view of live) view.requestUpdate();
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'lint-report-view': LintReportView;
    'eslint-html-view': EslintHtmlView;
  }
}
