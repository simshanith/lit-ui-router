import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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

/**
 * Floor for the report frame, so the collapsed report is no shorter than the
 * `report` panel beside it and switching tabs does not resize the page.
 */
const MIN_FRAME_HEIGHT = 420;

/** The `eslint-html` state: ESLint's own formatter, same results. */
@customElement('eslint-html-view')
export class EslintHtmlView extends ReportView {
  static styles = css`
    iframe {
      display: block;
      width: 100%;
      border: 1px solid light-dark(#d0d0d0, #30363d);
      border-radius: 0 6px 6px 6px;
      background: #fff;
    }
  `;

  @state() private frameHeight = MIN_FRAME_HEIGHT;

  private frameObserver?: ResizeObserver;

  disconnectedCallback() {
    this.frameObserver?.disconnect();
    this.frameObserver = undefined;
    super.disconnectedCallback();
  }

  // The formatter ships every message row hidden behind a click on its file
  // header, and its own script owns that toggle — so clicking each header is
  // how the report opens. Doing it on load means the height below is the
  // report's real height, reserved before anything is read rather than grown
  // when someone goes looking. A formatter that stopped emitting these rows
  // would leave the report closed, which is where it started.
  private expandAll(doc: Document) {
    // typed, not `instanceof`: these elements come from the frame's realm, so
    // they are not instances of this document's HTMLElement
    for (const group of doc.querySelectorAll<HTMLElement>('tr[data-group]')) {
      group.click();
    }
  }

  // The report's height is a runtime fact: pinned to a guess, an open report
  // nests one scroll area inside another. A `srcdoc` frame is same-origin, so
  // let the report's own layout size the frame, and keep observing it so a
  // collapse or a re-lint resizes it too.
  private fitFrame(event: Event) {
    const doc = (event.target as HTMLIFrameElement).contentDocument;
    if (!doc) return;
    const root = doc.documentElement;
    const measure = () => {
      this.frameHeight = Math.max(
        MIN_FRAME_HEIGHT,
        Math.ceil(root.getBoundingClientRect().height),
      );
    };
    this.frameObserver?.disconnect();
    this.frameObserver = new ResizeObserver(measure);
    this.frameObserver.observe(root);
    this.expandAll(doc);
    measure();
  }

  render() {
    // ESLint's html formatter emits a light-only document with no background
    // of its own, so pin the frame light instead of letting a dark canvas show
    // through under its hardcoded dark text. Inline because lit-analyzer's
    // no-invalid-css does not know `color-scheme` in a css block.
    return html`<iframe
      style="color-scheme: light; height: ${this.frameHeight}px"
      title="ESLint html formatter"
      srcdoc=${reportHtml}
      @load=${this.fitFrame}
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
