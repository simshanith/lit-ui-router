import { readFile } from 'node:fs/promises';

import { loadAndParseConfig } from '@cloudflare/config';
import * as v from 'valibot';

import { CF_CONFIG, parseJsonc } from './workers-builds-triggers.core.ts';

// Strict, so a key these configs start using fails here until the comparison knows it.
const ObservabilitySchema = v.strictObject({
  enabled: v.optional(v.boolean()),
  traces: v.optional(
    v.strictObject({
      enabled: v.optional(v.boolean()),
      headSamplingRate: v.optional(v.number()),
      persist: v.optional(v.boolean()),
      destinations: v.optional(v.array(v.string())),
    }),
  ),
});

/** A worker config's `observability` block, in `cloudflare.config.ts` spelling. */
export type WorkerObservability = v.InferOutput<typeof ObservabilitySchema>;

// wrangler.jsonc spells the same keys in snake case.
const WranglerSchema = v.looseObject({
  observability: v.optional(
    v.pipe(
      v.strictObject({
        enabled: v.optional(v.boolean()),
        traces: v.optional(
          v.strictObject({
            enabled: v.optional(v.boolean()),
            head_sampling_rate: v.optional(v.number()),
            persist: v.optional(v.boolean()),
            destinations: v.optional(v.array(v.string())),
          }),
        ),
      }),
      v.transform(({ traces, ...rest }) => {
        if (!traces) return rest;

        const { head_sampling_rate: headSamplingRate, ...kept } = traces;

        return {
          ...rest,
          traces:
            headSamplingRate === undefined
              ? kept
              : { ...kept, headSamplingRate },
        };
      }),
      ObservabilitySchema,
    ),
  ),
});

/** The `observability` block a worker config holds, whichever kind of file it is. */
export const workerObservability = async (
  path: string,
): Promise<WorkerObservability | undefined> => {
  if (!path.endsWith(CF_CONFIG)) {
    return v.parse(WranglerSchema, parseJsonc(await readFile(path, 'utf8')))
      .observability;
  }

  const { result } = await loadAndParseConfig(path, {
    isPreview: false,
    mode: undefined,
  });

  if (!result.success) throw new Error(`${path}: ${result.error.message}`);

  return v.parse(
    v.optional(ObservabilitySchema),
    result.data.worker?.observability,
  );
};
