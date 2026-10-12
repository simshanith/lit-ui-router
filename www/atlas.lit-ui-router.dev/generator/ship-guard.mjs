// SHIP-GUARD — a Claude Code PreToolUse hook on Bash. It reads the tool call on
// stdin and denies two commands that have one sanctioned road:
//   a wrangler Pages deploy that is not `generator/ship.mjs deploy`, whose check
//   step is the only thing standing between a raw app/dist and the live site;
//   a force-push to www/atlas, which the branch ruleset forbids for everyone.
// Everything else passes without a word. Wired in .claude/settings.json.
import { readFileSync } from 'node:fs';

let call = {};
try { call = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
const command = String(call?.tool_input?.command ?? '');
const deny = (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
};

if (/\bwrangler\b[^\n;&|]*\b(pages\s+deploy|deploy|publish)\b/.test(command) && !/generator\/ship\.mjs\s+deploy\b/.test(command)) {
  deny('ship-guard: the atlas deploys through `mise exec -- node www/atlas.lit-ui-router.dev/generator/ship.mjs deploy`, whose check step gates the upload; a bare wrangler deploy skips it.');
}
if (/\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*(--force|-f\b|\+www\/atlas)/.test(command) && /www\/atlas/.test(command)) {
  deny('ship-guard: www/atlas is never force-pushed; the ruleset forbids it and a wrong head cannot be undone. Add a follow-up commit.');
}
