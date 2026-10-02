#!/usr/bin/env node
// One program-wide lit-analyzer pass over every `src` .ts in packages/, apps/
// and examples/. Single invocation on purpose: lit-analyzer builds one tag
// registry across the whole run, which is what makes cross-package
// `<ui-view>`/`<ui-router>` usage resolve at all.
//
// examples/ are standalone npm projects that resolve a PUBLISHED lit-ui-router
// from their own lockfile-pinned node_modules (installed by the examples
// postinstall), so they are checked against the released surface rather than
// the workspace one. Verified that this does not shadow the workspace
// definitions: an injected `<ui-view nmae>` in apps/ is still reported.
//
// This drives lit-analyzer's API rather than its CLI because we swap one rule
// (no-incompatible-type-binding, see ./no-incompatible-type-binding.ts) and the
// analyzer has no rule plugin API: the rule collection is only reachable by
// overriding the context's `rules` getter. Everything else mirrors the stock
// `analyzeCommand`.
// Usage (from anywhere in the workspace): lint-templates
import { fileURLToPath } from 'node:url';

import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';
import {
  DefaultLitAnalyzerContext,
  LitAnalyzer,
  makeConfig,
} from 'lit-analyzer';
import { RuleCollection } from 'lit-analyzer/lib/analyze/rule-collection.js';
import {
  analyzeGlobs,
  type AnalyzeGlobsContext,
} from 'lit-analyzer/lib/cli/analyze-globs.js';
import { readLitAnalyzerConfigFromTsConfig } from 'lit-analyzer/lib/cli/compile.js';
import type { AnalysisStats } from 'lit-analyzer/lib/cli/format/diagnostic-formatter.js';
import { CodeDiagnosticFormatter } from 'lit-analyzer/lib/cli/format/code-diagnostic-formatter.js';
import type { LitAnalyzerCliConfig } from 'lit-analyzer/lib/cli/lit-analyzer-cli-config.js';
import { ALL_RULES } from 'lit-analyzer/lib/rules/all-rules.js';

import { noIncompatibleTypeBinding } from './no-incompatible-type-binding.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// Strictness and rule severities live in the root tsconfig's `ts-lit-plugin`
// entry, which lit-analyzer resolves from cwd. maxWarnings stays here: it is
// not a rule, and it makes findings the ruleset leaves at `warn` fail too.
const CLI_CONFIG: LitAnalyzerCliConfig = { maxWarnings: 0 };

class ExtendedContext extends DefaultLitAnalyzerContext {
  #rules: RuleCollection | undefined;

  override get rules(): RuleCollection {
    if (this.#rules == null) {
      this.#rules = new RuleCollection();
      this.#rules.push(
        ...ALL_RULES.filter((rule) => rule.id !== noIncompatibleTypeBinding.id),
        noIncompatibleTypeBinding,
      );
    }
    return this.#rules;
  }
}

process.chdir(root);

// The analyzer's own Program type, without a direct typescript dependency.
type Program = Parameters<
  NonNullable<AnalyzeGlobsContext['analyzeSourceFile']>
>[1]['program'];

// Set by analyzeSourceFile before the analyzer ever asks for it.
let program!: Program;
const context = new ExtendedContext({ getProgram: () => program });
context.updateConfig(
  makeConfig({ ...(readLitAnalyzerConfigFromTsConfig() ?? {}) }),
);

const analyzer = new LitAnalyzer(context);
const formatter = new CodeDiagnosticFormatter();
const stats: AnalysisStats = {
  diagnostics: 0,
  errors: 0,
  warnings: 0,
  filesWithProblems: 0,
  totalFiles: 0,
};

await analyzeGlobs([WORKSPACE_SRC_GLOB], CLI_CONFIG, {
  didExpandGlobs(filePaths) {
    console.log(
      filePaths.length === 0
        ? "\n  ✖ Couldn't find any files to analyze"
        : `Analyzing ${filePaths.length} file${filePaths.length === 1 ? '' : 's'}...`,
    );
  },
  analyzeSourceFile(file, options) {
    program = options.program;
    const diagnostics = analyzer.getDiagnosticsInFile(file);
    const text = formatter.diagnosticTextForFile(file, diagnostics);
    if (text != null) console.log(text);
    stats.diagnostics += diagnostics.length;
    stats.totalFiles += 1;
    if (diagnostics.length > 0) {
      stats.errors += diagnostics.filter((d) => d.severity === 'error').length;
      stats.warnings += diagnostics.filter(
        (d) => d.severity === 'warning',
      ).length;
      stats.filesWithProblems += 1;
    }
  },
});

const report = formatter.report(stats);
if (report != null) console.log(report);

// maxWarnings is 0, so a warning fails the gate exactly like an error.
process.exitCode = stats.errors > 0 || stats.warnings > 0 ? 1 : 0;
