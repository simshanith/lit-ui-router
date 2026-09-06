import { ESLint } from 'eslint';
import { defineConfig, type Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:lint-report';
// `\0` marks the id as synthetic so no other plugin tries to read it off disk
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const LINT_TARGETS = ['src/**/*.ts'];
const CONFIG_FILE = 'eslint.config.js';

// The formatter renders `<span>${summary}</span> - Generated on ${date}` on one
// line, so the stamp ends at the newline.
const GENERATED_ON = / - Generated on [^\n]*/;

// The stamped date is the only part of the formatter's output that varies
// without the input, and it lands in the bundle, so an unchanged source tree
// would still hash differently on every build. Warn rather than pass it
// through silently: a no-op here restores the nondeterminism unnoticed.
function stripGeneratedOn(html: string) {
  if (!GENERATED_ON.test(html)) {
    console.warn(
      "lint-report: no 'Generated on' stamp to strip — ESLint's html formatter " +
        'markup may have moved, and the build is no longer deterministic',
    );
    return html;
  }
  return html.replace(GENERATED_ON, '');
}

function lintReportPlugin(): Plugin {
  const root = import.meta.dirname;
  let eslint: ESLint | undefined;

  async function run() {
    eslint ??= new ESLint({ cwd: root });
    const lintResults = await eslint.lintFiles(LINT_TARGETS);
    const meta = eslint.getRulesMetaForResults(lintResults);
    const ruleDocs: Record<string, string> = {};
    for (const [ruleId, rule] of Object.entries(meta)) {
      const url = rule?.docs?.url;
      if (url) ruleDocs[ruleId] = url;
    }
    const relative = (filePath: string) =>
      filePath.slice(root.length + 1).replaceAll('\\', '/');
    // ESLint's own formatter, over the full results — before the `source`
    // strip below.
    // A loaded formatter supplies `cwd`/`rulesMeta` itself, so rule links work.
    const formatter = await eslint.loadFormatter('html');
    const html = stripGeneratedOn(
      await formatter.format(
        lintResults.map((r) => ({ ...r, filePath: relative(r.filePath) })),
      ),
    );
    // the ESLint result shape minus `source`, which the panel never renders
    const results = lintResults.map((result) => ({
      filePath: relative(result.filePath),
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      messages: result.messages.map((m) => ({
        line: m.line,
        column: m.column,
        endLine: m.endLine,
        endColumn: m.endColumn,
        severity: m.severity,
        ruleId: m.ruleId ?? null,
        message: m.message,
      })),
    }));
    const total = results.reduce(
      (n, r) => n + r.errorCount + r.warningCount,
      0,
    );
    console.log(
      `lint-report: ${total} problem${total === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}`,
    );
    return { results, ruleDocs, html };
  }

  function emit(report: { html: string }) {
    const { html, ...rest } = report;
    return `export default ${JSON.stringify(rest)};\nexport const html = ${JSON.stringify(html)};`;
  }

  return {
    name: 'lint-report',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      // Lint problems are this module's payload, never a build failure, and
      // `lintFiles` reports them rather than throwing. What throws is the run
      // itself failing — so let it, rather than ship a report reading zero.
      return emit(await run());
    },
    configureServer(server) {
      // watcher paths are compared normalized, so normalize the native root too
      const base = root.replaceAll('\\', '/');
      const configPath = `${base}/${CONFIG_FILE}`;
      const srcDir = `${base}/src/`;
      const onChange = (file: string) => {
        const path = file.replaceAll('\\', '/');
        if (path !== configPath && !path.startsWith(srcDir)) return;
        // flat-config resolution is cached on the instance
        if (path === configPath) eslint = undefined;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        // invalidateModule alone never pushes an update; reloadModule does
        if (mod) void server.reloadModule(mod);
      };
      for (const event of ['add', 'change', 'unlink'] as const) {
        server.watcher.on(event, onChange);
      }
    },
  };
}

export default defineConfig({
  plugins: [lintReportPlugin()],
  build: {
    target: 'esnext',
  },
});
