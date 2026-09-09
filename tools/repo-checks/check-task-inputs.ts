// Every tracked file in a task's package must be hashed by that task: a key
// that misses a file the task reads is a silent cache hit on a stale tree.
// The inverse costs cache hits rather than correctness, and is audited here
// too: a key that hashes generated output churns on every unrelated build,
// and the same input maps are most of the `--dry-run=json` the graph guards
// parse. The two halves fence each other — a negation wide enough to drop a
// tracked file trips the first audit. Only ignored files count as generated,
// so an unstaged new source file never fails the lane, and only a tracked
// .gitignore counts as an ignore rule, so no machine's global excludes can
// reach a verdict CI would not.
import { defaultExec } from '@tools/shared/exec.ts';
import {
  auditTaskInputs,
  formatFailure,
  formatOverhash,
  type InputsAllowance,
  type InputsExemption,
  narrowToGenerated,
  repoIgnored,
} from './task-inputs.core.ts';
import { plannedTasks } from './turbo.ts';
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

// Generated files a cache key hashes on purpose. Deliberately not checked for
// staleness the way EXEMPT is: whether a row is in use depends on what a given
// working tree has built, so the check would pass in CI and fail locally.
const ALLOWED: InputsAllowance[] = [
  {
    path: '.husky/_',
    why: 'husky writes a self-ignoring .gitignore here, which turbo hashes through $TURBO_DEFAULT$ anyway; one stable file, not a growing tree',
  },
  {
    path: 'www/lit-ui-router.dev/worker/worker-configuration.d.ts',
    why: 'types:worker output that type-aware oxlint genuinely reads through worker/tsconfig.json, so the lint key has to move with it',
  },
  {
    path: 'tools/release/.cache/published-versions.json',
    why: 'resolve:published writes it immediately before check:published-diff, which hashes it to capture the movable `latest` pointer (see tools/release/turbo.json)',
  },
];

/**
 * Which of `files` the repo's own ignore rules cover. Chunked because the
 * suspect list runs to tens of thousands before a lane is fixed, well past the
 * argv limit; check-ignore exits 1 when it matches nothing, which is an answer,
 * not a failure. `-v` names the rule behind each verdict so `repoIgnored` can
 * drop the ones only this machine would reach.
 */
async function ignoredFiles(
  files: readonly string[],
  tracked: ReadonlySet<string>,
): Promise<Set<string>> {
  const ignored = new Set<string>();
  for (let at = 0; at < files.length; at += 500) {
    const batch = files.slice(at, at + 500);
    const read = await defaultExec(
      'git',
      ['check-ignore', '-v', '--', ...batch],
      {
        cwd: workspaceRoot,
      },
    ).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'stdout' in error &&
        'code' in error &&
        error.code === 1
      ) {
        return { stdout: String(error.stdout) };
      }
      throw error;
    });
    for (const file of repoIgnored(read.stdout, tracked)) {
      ignored.add(file);
    }
  }
  return ignored;
}

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
const trackedFiles = new Set(tracked);

const planned = await plannedTasks(names);
const { failures, overhashing, stale, audited } = auditTaskInputs(
  [...planned.values()],
  tracked,
  EXEMPT,
  ALLOWED,
);

if (audited === 0) {
  // an empty plan would pass every assertion below; that's a wiring bug
  console.error(`${CHECK}: turbo planned no cacheable task`);
  process.exit(1);
}
for (const failure of failures) {
  console.error(`${CHECK}: ${formatFailure(failure)}`);
}
const generated = narrowToGenerated(
  overhashing,
  await ignoredFiles(
    [...new Set(overhashing.flatMap(({ untracked }) => untracked))],
    trackedFiles,
  ),
);
for (const over of generated) {
  console.error(`${CHECK}: ${formatOverhash(over)}`);
}
for (const name of stale) {
  console.error(
    `${CHECK}: "${name}" is exempt but hashes every tracked file now; drop the row`,
  );
}
if (failures.length > 0 || generated.length > 0 || stale.length > 0) {
  process.exit(1);
}

console.log(
  `${CHECK}: ${audited} cacheable tasks hash every tracked file in their package and nothing generated (${EXEMPT.length} file-type lanes exempt, ${ALLOWED.length} generated paths allowed)`,
);
