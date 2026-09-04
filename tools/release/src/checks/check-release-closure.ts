// Every member a release lane runs in must be inside the closure `setup --release` installs.
import { requireEnv } from '@tools/shared/env.core.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import {
  type ClosureRule,
  filterArgs,
  formatMissing,
  missingFromClosure,
  selectedNames,
} from './check-release-closure.core.ts';
import {
  loadWorkspace,
  type Member,
  workspaceRoot,
} from '@tools/shared/workspace.ts';

const CHECK = 'check-release-closure';
const FIX = 'widen RELEASE_CLOSURE in .config/mise/config.toml';

const hasScript = (task: string) => (member: Member) =>
  member.manifest?.scripts?.[task] !== undefined;
const hasDevDep = (dep: string) => (member: Member) =>
  member.manifest?.devDependencies?.[dep] !== undefined;
const publishable = (member: Member) =>
  member.dir !== '<root>' &&
  member.manifest !== undefined &&
  member.manifest.private !== true;

const RULES: (ClosureRule & { select: (member: Member) => boolean })[] = [
  {
    need: 'the release tool',
    select: (member) => member.name === '@tools/release',
    why: `every release lane runs its scripts; ${FIX}`,
  },
  {
    need: 'publishable packages',
    select: publishable,
    why: `release-signals builds and packs them through @tools/release#pack:all, and only a remote-cache hit hides a missing toolchain; ${FIX}`,
  },
  {
    need: 'release-it devDependencies',
    select: hasDevDep('release-it'),
    why: `bump-version and publish-gh run \`pnpm --filter <pkg> exec release-it\`; ${FIX}`,
  },
  {
    need: 'typecheck:peer-floor packages',
    select: hasScript('typecheck:peer-floor'),
    why: `the peer-floor check runs and the bump gate run the script via turbo, and a failed spawn reads as a stale floor; ${FIX}`,
  },
];

const closure = requireEnv(process.env, 'RELEASE_CLOSURE');
const [{ members }, { stdout }] = await Promise.all([
  loadWorkspace(workspaceRoot),
  defaultExec(
    'pnpm',
    ['ls', '-r', ...filterArgs(closure), '--depth', '-1', '--json'],
    { cwd: workspaceRoot },
  ),
]);
const selected = selectedNames(stdout);

let failed = false;
for (const rule of RULES) {
  const required = members.filter(rule.select).map((member) => member.name);
  if (required.length === 0) {
    // the invariant is vacuous if nothing matches; that's a wiring bug, not a pass
    console.error(`${CHECK}: no member selects for ${rule.need}`);
    failed = true;
    continue;
  }
  const missing = missingFromClosure(required, selected);
  if (missing.length > 0) {
    console.error(`${CHECK}: ${formatMissing(rule, missing)}`);
    failed = true;
    continue;
  }
  console.log(`${CHECK}: ${rule.need}: ${required.length} selected`);
}
if (failed) process.exit(1);
