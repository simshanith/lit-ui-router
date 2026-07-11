// Pure logic for the Workers Builds trigger check — no network or filesystem
// here, so every unit is directly testable with plain fixtures (see
// workers-builds-triggers.test.ts). The IO (env, Cloudflare API calls,
// reading wrangler.jsonc) lives in workers-builds-triggers.ts.

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';

// What the shell prints and exits on.
export type Report = { ok: boolean; text: string };

// The trigger fields this check reads/writes; the API returns more, PATCH
// accepts exactly these (https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).
export type Trigger = {
  trigger_uuid: string;
  trigger_name?: string;
  build_command?: string;
  deploy_command?: string;
  root_directory?: string;
  branch_includes?: string[];
  branch_excludes?: string[];
};

// Fields a desired spec may pin; unpinned fields are shown but never drift.
export const PINNABLE_FIELDS = [
  'build_command',
  'deploy_command',
  'root_directory',
] as const;
export type PinnableField = (typeof PINNABLE_FIELDS)[number];
export type DesiredTrigger = Partial<Record<PinnableField, string>>;
export type DesiredState = {
  productionBranch: string;
  production: DesiredTrigger;
  preview: DesiredTrigger;
};

export type TriggerKind = 'production' | 'preview';

// wrangler.jsonc allows comments and trailing commas, so JSON.parse alone
// won't do; jsonc-parser is the VS Code JSONC implementation.
export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const result: unknown = parse(text, errors, { allowTrailingComma: true });
  const [first] = errors;
  if (first) {
    throw new Error(
      `invalid JSONC at offset ${first.offset}: ${printParseErrorCode(first.error)}`,
    );
  }
  return result;
}

// Strict validation of workers-builds-triggers.config.jsonc: unknown or
// mistyped keys throw rather than silently un-pinning a field, since --apply
// writes this state to production.
export function desiredStateFromConfig(config: unknown): DesiredState {
  const record = asRecord(config, 'config');
  for (const key of Object.keys(record)) {
    if (!['productionBranch', 'production', 'preview'].includes(key)) {
      throw new Error(`config has unknown key "${key}"`);
    }
  }
  const { productionBranch } = record;
  if (typeof productionBranch !== 'string' || productionBranch === '') {
    throw new Error('config "productionBranch" must be a non-empty string');
  }
  return {
    productionBranch,
    production: desiredTrigger(record.production, 'production'),
    preview: desiredTrigger(record.preview, 'preview'),
  };
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

function desiredTrigger(value: unknown, kind: TriggerKind): DesiredTrigger {
  const record = asRecord(value, `config "${kind}"`);
  const desired: DesiredTrigger = {};
  for (const key of Object.keys(record)) {
    const field = PINNABLE_FIELDS.find((candidate) => candidate === key);
    if (!field) {
      throw new Error(
        `config ${kind}.${key} is not a pinnable field (expected: ${PINNABLE_FIELDS.join(', ')})`,
      );
    }
    const spec = record[field];
    if (typeof spec !== 'string' || spec === '') {
      throw new Error(`config ${kind}.${field} must be a non-empty string`);
    }
    desired[field] = spec;
  }
  return desired;
}

/** The `name` field of a parsed wrangler config, or throw. */
export function workerNameFromConfig(config: unknown): string {
  const name =
    typeof config === 'object' && config !== null
      ? (config as Record<string, unknown>).name
      : undefined;
  if (typeof name !== 'string' || name === '') {
    throw new Error('wrangler.jsonc has no "name" field');
  }
  return name;
}

// A trigger that builds the production branch is the production trigger;
// everything else (branch wildcards, main excluded) deploys previews.
export function classifyTrigger(
  trigger: Trigger,
  productionBranch: string,
): TriggerKind {
  const includes = trigger.branch_includes ?? [];
  const excludes = trigger.branch_excludes ?? [];
  return includes.includes(productionBranch) &&
    !excludes.includes(productionBranch)
    ? 'production'
    : 'preview';
}

export type Drift = {
  trigger_uuid: string;
  kind: TriggerKind;
  // Exactly the body to PATCH /builds/triggers/{uuid} with.
  patch: Partial<Record<PinnableField, string>>;
};

export type DiffResult = { report: Report; drifts: Drift[] };

function describeTrigger(
  trigger: Trigger,
  kind: TriggerKind,
  desired: DesiredTrigger,
): { lines: string[]; patch: Drift['patch'] } {
  const patch: Drift['patch'] = {};
  const lines = [
    `${kind} trigger ${trigger.trigger_uuid}` +
      (trigger.trigger_name ? ` (${trigger.trigger_name})` : ''),
    `    branches           include=${JSON.stringify(trigger.branch_includes ?? [])} exclude=${JSON.stringify(trigger.branch_excludes ?? [])}`,
  ];
  for (const field of PINNABLE_FIELDS) {
    const current = trigger[field] ?? '';
    const wanted = desired[field];
    if (wanted === undefined) {
      lines.push(
        `    ${field.padEnd(18)} ${current || '(empty)'} (not pinned)`,
      );
    } else if (current === wanted) {
      lines.push(`  ✓ ${field.padEnd(18)} ${current}`);
    } else {
      patch[field] = wanted;
      lines.push(`  ✗ ${field.padEnd(18)} ${current || '(empty)'}`);
      lines.push(`    ${' '.repeat(18)} wanted: ${wanted}`);
    }
  }
  return { lines, patch };
}

/** Diff live triggers against the desired state. */
export function diffTriggers(
  triggers: Trigger[],
  desired: DesiredState,
): DiffResult {
  const drifts: Drift[] = [];
  const lines: string[] = [];
  const seen: Record<TriggerKind, number> = { production: 0, preview: 0 };

  for (const trigger of triggers) {
    const kind = classifyTrigger(trigger, desired.productionBranch);
    seen[kind] += 1;
    const { lines: triggerLines, patch } = describeTrigger(
      trigger,
      kind,
      desired[kind],
    );
    lines.push(...triggerLines, '');
    if (Object.keys(patch).length > 0) {
      drifts.push({ trigger_uuid: trigger.trigger_uuid, kind, patch });
    }
  }

  // PATCH cannot create triggers, so a missing kind is unfixable drift.
  const missing = (['production', 'preview'] as const).filter(
    (kind) => seen[kind] === 0,
  );
  for (const kind of missing) {
    lines.push(`  ✗ no ${kind} trigger found (create it in the dashboard)`, '');
  }

  const ok = drifts.length === 0 && missing.length === 0;
  lines.push(
    ok
      ? '✓ Workers Builds triggers match the desired state.'
      : `✗ ${drifts.length + missing.length} trigger(s) drifted from the desired state.`,
  );
  return { report: { ok, text: lines.join('\n') }, drifts };
}
