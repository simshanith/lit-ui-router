import { ESLint } from 'eslint';
import { defineConfig, type Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:lint-report';
// `\0` marks the id as synthetic so no other plugin tries to read it off disk
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const LINT_TARGETS = ['src/**/*.ts'];
const CONFIG_FILE = 'eslint.config.js';

const EMPTY = { results: [], ruleDocs: {} };

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
    // the ESLint result shape minus `source`, which the panel never renders
    const results = lintResults.map((result) => ({
      filePath: result.filePath.slice(root.length + 1).replaceAll('\\', '/'),
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
    return { results, ruleDocs };
  }

  return {
    name: 'lint-report',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return undefined;
      // lint problems are this module's payload, never a build failure
      try {
        return `export default ${JSON.stringify(await run())};`;
      } catch (error) {
        this.warn(`lint-report: ${String(error)}`);
        return `export default ${JSON.stringify(EMPTY)};`;
      }
    },
    configureServer(server) {
      const configPath = `${root}/${CONFIG_FILE}`;
      const srcDir = `${root}/src/`;
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
