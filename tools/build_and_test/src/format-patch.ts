#!/usr/bin/env node
// Writes this session's formatting fixes to .turbo/format.patch, so CI can
// upload it before run-summary.ts links the upload. Fails open like the
// reporter: every failure path warns and exits 0.

import { FORMAT_PATCH } from './format-annotations.core.ts';
import { formattingFixes } from './format-diff.ts';
import { readSession, warn } from './session.ts';

const failOpen = (cause: unknown): void => {
  warn(
    `format-patch: no ${FORMAT_PATCH}, the run summary still reports the findings: ${
      cause instanceof Error ? cause.message : String(cause)
    }`,
  );
};

const main = async (): Promise<void> => {
  const session = await readSession();

  if (session === undefined) return;
  const { patch } = formattingFixes(session);

  if (patch === undefined) {
    console.log(`format-patch: no formatting fix to write to ${FORMAT_PATCH}`);

    return;
  }

  console.log(
    `format-patch: wrote ${patch.files} ${patch.files === 1 ? 'file' : 'files'} of fixes to ${FORMAT_PATCH}`,
  );
};

if (import.meta.main) await main().catch(failOpen);
