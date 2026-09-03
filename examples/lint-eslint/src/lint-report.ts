import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/** One message from an ESLint result, minus `fix`/`suggestions`. */
export interface LintMessage {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: number;
  ruleId: string | null;
  message: string;
}

/** One entry of `ESLint#lintFiles()`, minus `source`. */
export interface LintResult {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
}

/**
 * Renders ESLint results. Data in, markup out: no ESLint import, no build-tool
 * coupling, so a browser-side linter can drive the same element.
 */
@customElement('lint-report')
export class LintReportPanel extends LitElement {
  static styles = css`
    /* self-contained: the panel follows the reader's preference on its own,
       whatever host it is dropped into */
    :host {
      color-scheme: light dark;
      display: block;
      margin-top: 24px;
      border: 1px solid light-dark(#d0d0d0, #30363d);
      border-radius: 6px;
      background: light-dark(#fff, #161b22);
      color: light-dark(#24292f, #e6edf3);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
    }
    :host([hidden]) {
      display: none;
    }
    h2 {
      margin: 0;
      padding: 10px 14px;
      border-bottom: 1px solid light-dark(#d0d0d0, #30363d);
      font-size: 13px;
      font-weight: 600;
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
    }
    p {
      margin: 0;
      padding: 10px 14px;
    }
    .clean {
      color: light-dark(#1a7f37, #3fb950);
    }
    .file {
      padding: 10px 14px;
      border-top: 1px solid light-dark(#eee, #21262d);
    }
    .file-name {
      font-weight: 600;
      margin-bottom: 6px;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      padding: 2px 0;
    }
    .loc,
    .rule {
      color: light-dark(#666, #8b949e);
    }
    .error {
      color: light-dark(#cf222e, #f85149);
    }
    .warn {
      color: light-dark(#9a6700, #d29922);
    }
    a {
      color: inherit;
    }
  `;

  /** `ESLint#lintFiles()` output, or a `Linter#verify()` result wrapped up. */
  @property({ attribute: false })
  results: LintResult[] = [];

  /** Rule id to docs URL, e.g. from `getRulesMetaForResults()`. */
  @property({ attribute: false })
  ruleDocs: Record<string, string> = {};

  private renderMessage(m: LintMessage) {
    const url = m.ruleId ? this.ruleDocs[m.ruleId] : undefined;
    const rule = url
      ? html`<a href=${url} target="_blank" rel="noreferrer">${m.ruleId}</a>`
      : m.ruleId;
    return html`<li>
      <span class="loc">${m.line}:${m.column}</span>
      <span class=${m.severity === 2 ? 'error' : 'warn'}
        >${m.severity === 2 ? 'error' : 'warning'}</span
      >
      ${m.message}
      ${m.ruleId ? html`<span class="rule">(${rule})</span>` : nothing}
    </li>`;
  }

  private renderResult(result: LintResult) {
    return html`<div class="file">
      <div class="file-name">${result.filePath}</div>
      <ul>
        ${result.messages.map((m) => this.renderMessage(m))}
      </ul>
    </div>`;
  }

  render() {
    const errors = this.results.reduce((n, r) => n + r.errorCount, 0);
    const warnings = this.results.reduce((n, r) => n + r.warningCount, 0);
    const names = this.results.map((r) => r.filePath).join(', ');
    return html`
      <h2>ESLint report</h2>
      ${
        errors + warnings === 0
          ? html`<p class="clean">✓ 0 problems in ${names}</p>`
          : html`<p>
                ${errors} error${errors === 1 ? '' : 's'}, ${warnings}
                warning${warnings === 1 ? '' : 's'}
              </p>
              ${this.results
                .filter((r) => r.messages.length > 0)
                .map((r) => this.renderResult(r))}`
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lint-report': LintReportPanel;
  }
}
