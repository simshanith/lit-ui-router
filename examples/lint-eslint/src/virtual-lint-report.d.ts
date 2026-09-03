declare module 'virtual:lint-report' {
  import type { LintResult } from './lint-report.js';

  export interface LintReport {
    results: LintResult[];
    ruleDocs: Record<string, string>;
  }

  const report: LintReport;
  export default report;
}
