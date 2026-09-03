// Every tracked file in a task's package must be hashed by that task: a key
// that misses a file the task reads is a silent cache hit on a stale tree.
import { defaultExec } from '@tools/shared/exec.ts';
import {
  auditTaskInputs,
  formatFailure,
  type InputsExemption,
} from '@tools/shared/task-inputs.core.ts';
import { plannedTasks } from '@tools/shared/turbo.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const CHECK = 'check-task-inputs';

// Lanes whose read-set genuinely is one file type, so the glob is the key.
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
    why: 'wrangler --dry-run bundles worker/** only; docs content never reaches the artifact',
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
