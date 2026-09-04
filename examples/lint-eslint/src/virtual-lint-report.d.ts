declare module 'virtual:lint-report' {
  import type { LintResult } from './lint-report.js';

  export interface LintReport {
    results: LintResult[];
    ruleDocs: Record<string, string>;
  }

  /** The same results through ESLint's built-in `html` formatter. */
  export const html: string;

  const report: LintReport;
  export default report;
}
