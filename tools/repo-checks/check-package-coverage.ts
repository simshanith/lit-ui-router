// //#lint:package-json reports only findings, so nothing shows a manifest that
// drops out of it — an eslint ignore, a narrowed glob, a nested eslint.config.
// Fail when the linted set differs from the tracked one, less EXCLUDED, then
// print one row per manifest: what lints it, workspace membership, catalog
// entry, and the turbo umbrellas its scripts join.
import { dirname, join, relative } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  isRootMember,
  loadWorkspace,
  selectCatalogs,
} from '@tools/shared/workspace.ts';
import { ESLint } from 'eslint';

import { trackedFiles } from './cli-query.ts';
import {
  auditCoverage,
  type CoverageRow,
  type Exclusion,
  formatCoverage,
  parseLintPatterns,
  scriptTasks,
} from './package-coverage.core.ts';

const CHECK = 'check-package-coverage';

const SCRIPT = 'lint:package-json';

// Tracked manifests the lane leaves out on purpose. A row that is linted again,
// or no longer tracked, fails.
const EXCLUDED: Exclusion[] = [
  {
    file: 'examples/lint-eslint/package.json',
    why: 'ships its own eslint.config.js, which ESLint resolves ahead of the root one; eslint.config.ts ignores the tree',
  },
];

const script = requireManifest(workspaceRoot).scripts?.[SCRIPT];

if (!script) {
  console.error(`${CHECK}: root package.json has no ${SCRIPT} script`);
  process.exit(1);
}

// eslint-plugin-oxlint reads ./.oxlintrc.json against the process cwd.
process.chdir(workspaceRoot);

const eslint = new ESLint({ cwd: workspaceRoot });

const linted: string[] = [];

for (const { filePath } of await eslint.lintFiles(parseLintPatterns(script))) {
  // an explicitly named file comes back as an "ignored" warning, not a lint
  if (!(await eslint.isPathIgnored(filePath))) {
    linted.push(relative(workspaceRoot, filePath));
  }
}

const tracked = trackedFiles(':(glob)**/package.json', 'pnpm-workspace.yaml');

const { missing, extra, stale } = auditCoverage(tracked, linted, EXCLUDED);

for (const file of missing) {
  console.error(
    `${CHECK}: ${file} is tracked but ${SCRIPT} does not lint it; lint it, or add it to EXCLUDED with a reason`,
  );
}

for (const file of extra) {
  console.error(
    `${CHECK}: ${SCRIPT} lints ${file}, which is in EXCLUDED or untracked (git add a new manifest)`,
  );
}

for (const file of stale) {
  console.error(
    `${CHECK}: ${file} is in EXCLUDED but is not a tracked manifest; drop the row`,
  );
}

const { members, workspaceManifest } = await loadWorkspace(workspaceRoot);

const memberDirs = new Map(
  members.map((member) => [isRootMember(member) ? '.' : member.dir, member]),
);

const catalogued = new Set(
  Object.keys((await selectCatalogs(workspaceManifest)).workspace ?? {}),
);

const excludedFiles = new Set(EXCLUDED.map(({ file }) => file));

const missingFiles = new Set(missing);

const eslintStatus = (file: string): CoverageRow['eslint'] => {
  if (missingFiles.has(file)) return 'MISSING';

  return excludedFiles.has(file) ? 'excluded' : 'linted';
};

const row = (file: string): CoverageRow => {
  const dir = dirname(file);
  const member = memberDirs.get(dir);

  // turbo never plans a standalone project, so its scripts join no umbrella
  if (!member) {
    const { name = '-' } = requireManifest(join(workspaceRoot, dir));
    const tasks = new Set<never>();

    return {
      dir,
      name,
      eslint: eslintStatus(file),
      member: '-',
      catalog: false,
      tasks,
    };
  }

  return {
    dir,
    name: member.name,
    eslint: eslintStatus(file),
    member: isRootMember(member) ? 'root' : 'member',
    catalog: catalogued.has(member.name),
    tasks: scriptTasks(member.manifest?.scripts),
  };
};

const rows = tracked
  .filter((file) => file.endsWith('package.json'))
  .map(row)
  .sort((a, b) => a.dir.localeCompare(b.dir));

for (const line of formatCoverage(rows)) console.log(line);

if (missing.length > 0 || extra.length > 0 || stale.length > 0) {
  console.error(
    `${CHECK}: ${missing.length} missing, ${extra.length} unexpected, ${stale.length} stale`,
  );
  process.exit(1);
}

console.log(
  `${CHECK}: ${SCRIPT} lints ${linted.length} of ${tracked.length} tracked manifests (${EXCLUDED.length} excluded)`,
);
