// Pure logic for the Workers Builds trigger check — no network or filesystem
// here, so every unit is directly testable with plain fixtures (see
// workers-builds-triggers.test.ts). The IO (env, Cloudflare API calls,
// reading the worker config) lives in workers-builds-triggers.ts.

import type { Json } from '@tools/bootstrap/types.ts';
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import * as v from 'valibot';

// What the shell prints and exits on.
export type Report = { ok: boolean; text: string };

// One entry of a trigger's build environment-variable map. Cloudflare may
// redact `value` when `is_secret` is true, so an absent value is not "empty".
export type TriggerEnvironmentVariable = {
  value?: string;
  is_secret?: boolean;
};

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
  path_includes?: string[];
  path_excludes?: string[];
  environment_variables?: Record<string, TriggerEnvironmentVariable>;
};

/**
 * A Worker switched to Workers Previews has no preview trigger; its preview
 * builds run on this, the `previews_base_config` of GET /builds/workers/{tag}.
 */
export type PreviewsBaseConfig = Omit<
  Trigger,
  'trigger_uuid' | 'trigger_name' | 'branch_includes' | 'branch_excludes'
>;

/** Stands in for a trigger uuid, so the shell PATCHes the Worker rather than a trigger. */
export const PREVIEWS_BASE_CONFIG = 'previews_base_config';

/** The Previews base config as the preview trigger it replaced: no branches, so it classifies as preview. */
export const previewsBaseTrigger = (config: PreviewsBaseConfig): Trigger => ({
  ...config,
  trigger_uuid: PREVIEWS_BASE_CONFIG,
  trigger_name: 'Workers Previews base config',
});

// Scalar fields a desired spec may pin; unpinned fields are shown but never
// drift. environment_variables is pinned per key, not whole-field — see
// describeEnvironment.
export const PINNABLE_FIELDS = [
  'build_command',
  'deploy_command',
  'root_directory',
] as const;

export type PinnableField = (typeof PINNABLE_FIELDS)[number];

// Build watch paths: array-valued, so pinned and patched whole-list rather than
// per-entry (https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/).
export const PINNABLE_LIST_FIELDS = ['path_includes', 'path_excludes'] as const;

export type PinnableListField = (typeof PINNABLE_LIST_FIELDS)[number];

const nonEmptyString = v.pipe(v.string(), v.nonEmpty());

// Shell-legal variable names only, so a typoed key is a config error too.
const environmentKey = v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/));

// strictObject: an unknown or typoed key throws rather than silently
// un-pinning a field, since --apply writes this state to production.
const DesiredTriggerSchema = v.strictObject({
  build_command: v.optional(nonEmptyString),
  deploy_command: v.optional(nonEmptyString),
  root_directory: v.optional(nonEmptyString),
  path_includes: v.optional(v.array(nonEmptyString)),
  path_excludes: v.optional(v.array(nonEmptyString)),
  // Declared keys are plaintext by construction; secrets stay dashboard-only.
  environment_variables: v.optional(v.record(environmentKey, nonEmptyString)),
} satisfies Record<
  PinnableField | PinnableListField | 'environment_variables',
  v.GenericSchema
>);

// One worker: the config that names it (wrangler.jsonc or cloudflare.config.ts), plus its two triggers.
const DesiredStateSchema = v.strictObject({
  workerConfig: nonEmptyString,
  productionBranch: nonEmptyString,
  production: DesiredTriggerSchema,
  preview: DesiredTriggerSchema,
});

// Keyed by site, so the config reads as the list of sites this repo deploys.
const DesiredWorkersSchema = v.strictObject({
  workers: v.record(nonEmptyString, DesiredStateSchema),
});

export type DesiredTrigger = v.InferOutput<typeof DesiredTriggerSchema>;

export type DesiredState = v.InferOutput<typeof DesiredStateSchema>;

export type DesiredWorker = DesiredState & { site: string };

export type TriggerKind = 'production' | 'preview';

// wrangler.jsonc allows comments and trailing commas, so JSON.parse alone
// won't do; jsonc-parser is the VS Code JSONC implementation.
export function parseJsonc(text: string): Json {
  const errors: ParseError[] = [];
  // SAFETY: jsonc-parser's parse builds only JSON values
  const result = parse(text, errors, { allowTrailingComma: true }) as Json;
  const [first] = errors;

  if (first) {
    throw new Error(
      `invalid JSONC at offset ${first.offset}: ${printParseErrorCode(first.error)}`,
    );
  }

  return result;
}

// Strict validation; every issue is reported, prefixed with its dot path into
// the config.
function validate<Schema extends v.GenericSchema>(
  schema: Schema,
  config: Json,
): v.InferOutput<Schema> {
  const result = v.safeParse(schema, config);

  if (!result.success) {
    const details = result.issues.map((issue) => {
      const path = v.getDotPath(issue);

      return path ? `  ${path}: ${issue.message}` : `  ${issue.message}`;
    });

    throw new Error(['invalid config:', ...details].join('\n'));
  }

  return result.output;
}

/** One worker's desired state, the unit workers-builds-triggers.config.jsonc repeats. */
export function desiredStateFromConfig(config: Json): DesiredState {
  return validate(DesiredStateSchema, config);
}

/** Every worker in workers-builds-triggers.config.jsonc, tagged with its site key. */
export function desiredWorkersFromConfig(config: Json): DesiredWorker[] {
  const { workers } = validate(DesiredWorkersSchema, config);

  return Object.entries(workers).map(([site, worker]) => ({ site, ...worker }));
}

/** The workers a `--site` selection names, or why it names none. */
export type SelectResult =
  | { readonly ok: true; readonly workers: DesiredWorker[] }
  | { readonly ok: false; readonly error: string };

/**
 * The workers a `--site` selection names, in config order; no selection means
 * every worker. An unknown name fails rather than selecting nothing, since a
 * typo under --apply would otherwise read as "in sync".
 */
export function selectWorkers(
  workers: DesiredWorker[],
  sites: readonly string[],
): SelectResult {
  if (sites.length === 0) return { ok: true, workers };
  const known = workers.map((worker) => worker.site);
  const unknown = sites.filter((site) => !known.includes(site));

  if (unknown.length > 0) {
    return {
      ok: false,
      error: `unknown site(s): ${unknown.join(', ')} — configured: ${known.join(', ')}`,
    };
  }

  return {
    ok: true,
    workers: workers.filter((worker) => sites.includes(worker.site)),
  };
}

// looseObject: a worker config has many fields; only `name` matters here.
const NameSchema = v.looseObject({ name: nonEmptyString });

/** The `name` field of a parsed wrangler config, or throw. */
export function workerNameFromConfig(config: Json): string {
  const result = v.safeParse(NameSchema, config);

  if (!result.success) {
    throw new Error('wrangler.jsonc has no "name" field');
  }

  return result.output.name;
}

/** The file name that makes a site a cf project rather than a Wrangler one. */
export const CF_CONFIG = 'cloudflare.config.ts';

/** How cf evaluates a function-form config for a production deploy. */
const PRODUCTION_CONTEXT = { isPreview: false, mode: undefined } as const;

/** A cf config value: an object, a promise of one, or a function of the evaluation context returning either. */
export type ConfigInput<T> =
  | T
  | Promise<T>
  | ((context: typeof PRODUCTION_CONTEXT) => T | Promise<T>);

/** The slice of a cloudflare.config.ts default export this check reads. */
export type CfConfig = { readonly worker?: ConfigInput<object> };

const resolveConfigInput = async <T extends object>(
  input: ConfigInput<T>,
): Promise<T> =>
  input instanceof Function ? input(PRODUCTION_CONTEXT) : input;

/** The production Worker name a cloudflare.config.ts default export resolves to, or throw. */
export async function workerNameFromCfConfig(
  config: ConfigInput<CfConfig>,
): Promise<string> {
  const { worker } = await resolveConfigInput(config);

  const result = v.safeParse(
    NameSchema,
    worker && (await resolveConfigInput(worker)),
  );

  if (!result.success) {
    throw new Error(`${CF_CONFIG} has no worker "name"`);
  }

  return result.output.name;
}

// Only the D1 fields the production deploy migrates by.
const WranglerD1Schema = v.looseObject({
  d1_databases: v.optional(
    v.array(
      v.looseObject({
        database_name: nonEmptyString,
        migrations_dir: v.optional(nonEmptyString),
      }),
    ),
  ),
});

/** The D1 databases a wrangler.jsonc gives a `migrations_dir`, by `database_name`. */
export function migratedDatabasesFromConfig(config: Json): string[] {
  const { d1_databases = [] } = validate(WranglerD1Schema, config);

  return d1_databases
    .filter((database) => database.migrations_dir !== undefined)
    .map((database) => database.database_name);
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

// Body for PATCH /builds/triggers/{uuid}/environment_variables. Only declared
// keys ever appear, so undeclared live vars survive whatever the API's merge
// semantics are.
export type EnvironmentPatch = Record<
  string,
  { value: string; is_secret: false }
>;

export type Drift = {
  trigger_uuid: string;
  kind: TriggerKind;
  // Exactly the body to PATCH /builds/triggers/{uuid} with.
  patch: Partial<
    Record<PinnableField, string> & Record<PinnableListField, string[]>
  >;
  environmentPatch: EnvironmentPatch;
};

export type DiffResult = { report: Report; drifts: Drift[] };

const ENV_PAD = 34;

// Per-key management: a declared key drifts on a wrong or absent live value; an
// undeclared live key is listed as unmanaged and never diffed or patched. A
// declared key that is live-secret is a conflict — reported, never overwritten.
interface EnvironmentDescription {
  lines: string[];
  patch: EnvironmentPatch;
  conflicts: string[];
}

function describeEnvironment(
  live: Record<string, TriggerEnvironmentVariable>,
  declared: Record<string, string>,
): EnvironmentDescription {
  const patch: EnvironmentPatch = {};
  const conflicts: string[] = [];
  const lines: string[] = [];
  const liveKeys = Object.keys(live).sort();

  if (liveKeys.length === 0 && Object.keys(declared).length === 0) {
    return { lines, patch, conflicts };
  }

  lines.push('    environment_variables');

  for (const [key, wanted] of Object.entries(declared)) {
    const current = live[key];

    if (current?.is_secret) {
      conflicts.push(key);
      lines.push(
        `  ✗   ${key.padEnd(ENV_PAD)} (secret) — declared in config; refusing to overwrite`,
      );
    } else if (current?.value === wanted) {
      lines.push(`  ✓   ${key.padEnd(ENV_PAD)} ${wanted}`);
    } else {
      patch[key] = { value: wanted, is_secret: false };
      lines.push(
        `  ✗   ${key.padEnd(ENV_PAD)} ${current?.value ?? '(absent)'}`,
        `      ${' '.repeat(ENV_PAD)} wanted: ${wanted}`,
      );
    }
  }

  // Values omitted: an unmanaged var may hold a credential this tool prints.
  for (const key of liveKeys.filter((key) => !(key in declared))) {
    lines.push(
      `      ${key.padEnd(ENV_PAD)} ${live[key]?.is_secret ? '(secret) ' : ''}(unmanaged)`,
    );
  }

  return { lines, patch, conflicts };
}

function describePinnedFields(
  trigger: Trigger,
  desired: DesiredTrigger,
  patch: Drift['patch'],
): string[] {
  const lines: string[] = [];

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

  return lines;
}

// Watch paths are only worth a line when pinned or actually set: every
// trigger defaults to include-everything, and printing that twice is noise.
function describeWatchPaths(
  trigger: Trigger,
  desired: DesiredTrigger,
  patch: Drift['patch'],
): string[] {
  const lines: string[] = [];

  for (const field of PINNABLE_LIST_FIELDS) {
    const current = trigger[field] ?? [];
    const wanted = desired[field];
    const shown = JSON.stringify(current);

    if (wanted === undefined) {
      if (current.length > 0) {
        lines.push(`    ${field.padEnd(18)} ${shown} (not pinned)`);
      }
    } else if (shown === JSON.stringify(wanted)) {
      lines.push(`  ✓ ${field.padEnd(18)} ${shown}`);
    } else {
      patch[field] = wanted;
      lines.push(
        `  ✗ ${field.padEnd(18)} ${shown}`,
        `    ${' '.repeat(18)} wanted: ${JSON.stringify(wanted)}`,
      );
    }
  }

  return lines;
}

interface TriggerDescription {
  lines: string[];
  patch: Drift['patch'];
  environmentPatch: EnvironmentPatch;
  drift: boolean;
}

function describeTrigger(
  trigger: Trigger,
  kind: TriggerKind,
  desired: DesiredTrigger,
): TriggerDescription {
  const patch: Drift['patch'] = {};

  const lines = [
    `${kind} trigger ${trigger.trigger_uuid}` +
      (trigger.trigger_name ? ` (${trigger.trigger_name})` : ''),
    `    branches           include=${JSON.stringify(trigger.branch_includes ?? [])} exclude=${JSON.stringify(trigger.branch_excludes ?? [])}`,
    ...describePinnedFields(trigger, desired, patch),
    ...describeWatchPaths(trigger, desired, patch),
  ];

  const environment = describeEnvironment(
    trigger.environment_variables ?? {},
    desired.environment_variables ?? {},
  );

  lines.push(...environment.lines);

  return {
    lines,
    patch,
    environmentPatch: environment.patch,
    drift:
      Object.keys(patch).length > 0 ||
      Object.keys(environment.patch).length > 0 ||
      environment.conflicts.length > 0,
  };
}

/** Diff live triggers against the desired state. */
export function diffTriggers(
  triggers: Trigger[],
  desired: DesiredState,
): DiffResult {
  const drifts: Drift[] = [];
  const lines: string[] = [];
  const seen: Record<TriggerKind, number> = { production: 0, preview: 0 };
  // A conflicted trigger fails the check without being patchable, so it counts
  // here rather than in drifts.
  let drifted = 0;

  for (const trigger of triggers) {
    const kind = classifyTrigger(trigger, desired.productionBranch);
    seen[kind] += 1;

    const {
      lines: triggerLines,
      patch,
      environmentPatch,
      drift,
    } = describeTrigger(trigger, kind, desired[kind]);

    lines.push(...triggerLines, '');

    if (drift) drifted += 1;

    if (
      Object.keys(patch).length > 0 ||
      Object.keys(environmentPatch).length > 0
    ) {
      drifts.push({
        trigger_uuid: trigger.trigger_uuid,
        kind,
        patch,
        environmentPatch,
      });
    }
  }

  // PATCH cannot create triggers, so a missing kind is unfixable drift.
  const missing = (['production', 'preview'] as const).filter(
    (kind) => seen[kind] === 0,
  );

  for (const kind of missing) {
    lines.push(`  ✗ no ${kind} trigger found (create it in the dashboard)`, '');
  }

  const ok = drifted === 0 && missing.length === 0;
  lines.push(
    ok
      ? '✓ Workers Builds triggers match the desired state.'
      : `✗ ${drifted + missing.length} trigger(s) drifted from the desired state.`,
  );

  return { report: { ok, text: lines.join('\n') }, drifts };
}
