// Turbo `inputs` must over-approximate: a cache key that misses a file the
// task reads is a silent `cache hit` + `exit 0` on a tree the task would have
// rejected (#260-#262 typecheck:root and format:check:root, #693 the test
// lanes and their setup files). The invariant: every tracked file in a task's
// package is hashed by that task. Task names come from the workspace
// manifests and the hashed set from turbo's own dry run, so nothing here
// parses a turbo.json.
import { defaultExec } from '@tools/shared/exec.ts';
import {
  auditTaskInputs,
  formatFailure,
  type InputsExemption,
} from '@tools/shared/task-inputs.core.ts';
import { plannedTasks } from '@tools/shared/turbo.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const CHECK = 'check-task-inputs';

// Lanes whose read-set genuinely is one file type: the glob IS the contract,
// and $TURBO_DEFAULT$ would only cache-miss on every unrelated change.
const EXEMPT: InputsExemption[] = [
  {
    task: 'format:check',
    why: 'oxfmt formats one glob of source extensions; LICENSE, .env and binary assets are not in it',
  },
  { task: 'format:check:toml', why: 'taplo runs over tracked *.toml only' },
  { task: 'lint:toml', why: 'taplo lints tracked *.toml only' },
  { task: 'lint:markdown', why: 'rumdl lints tracked *.md only' },
  {
    task: 'lint:shellcheck',
    why: 'shellcheck reads tracked shell scripts only',
  },
  { task: 'lint:actionlint', why: 'actionlint reads .github workflows only' },
  { task: 'lint:zizmor', why: 'zizmor reads .github workflows only' },
  {
    task: 'bundle:worker',
    why: 'wrangler --dry-run bundles worker/** only; docs content never reaches the artifact (docs/turbo.json says why)',
  },
];

const { members } = await loadWorkspace(workspaceRoot);
const names = [
  ...new Set(
    members.flatMap((member) => Object.keys(member.manifest?.scripts ?? {})),
  ),
].sort();

const { stdout } = await defaultExec('git', ['ls-files', '-z'], {
  cwd: workspaceRoot,
});
const tracked = stdout.split('\0').filter((file) => file !== '');

const planned = await plannedTasks(names);
const { failures, stale, audited } = auditTaskInputs(
  [...planned.values()],
  tracked,
  EXEMPT,
);

if (audited === 0) {
  // an empty plan would pass every assertion below; that's a wiring bug
  console.error(`${CHECK}: turbo planned no cacheable task`);
  process.exit(1);
}
for (const failure of failures) {
  console.error(`${CHECK}: ${formatFailure(failure)}`);
}
for (const name of stale) {
  console.error(
    `${CHECK}: "${name}" is exempt but hashes every tracked file now; drop the row`,
  );
}
if (failures.length > 0 || stale.length > 0) process.exit(1);

console.log(
  `${CHECK}: ${audited} cacheable tasks hash every tracked file in their package (${EXEMPT.length} file-type lanes exempt)`,
);
