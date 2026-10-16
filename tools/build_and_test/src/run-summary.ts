#!/usr/bin/env node
// Reports a `turbo run` on both lanes: `$GITHUB_STEP_SUMMARY` (rendered
// markdown, for humans reading the run page) and stdout (for agents, which
// reach CI through the logs API and never see a step summary).
//
// Two sections. The overview runs every time — cache split, slowest tasks,
// longest dependency chain — because a green run still hides things worth
// knowing. The failure detail is appended only when a task actually failed,
// and is empty rather than absent on a green run: `failedTasks()` returns [].
// On Actions, annotation commands the tools wrote into their task logs are
// re-emitted too, since turbo's line prefix keeps the runner from seeing them.
//
// Input is every `.turbo/runs/*.json` this session wrote, in the order they
// ran — `mise run ci` invokes turbo three times (the graph, the docs build,
// the e2e suites), and reporting only the newest showed whichever finished
// last. The session boundary comes from the marker the `mark_session` task
// writes; without one this reports the newest run alone. See
// run-summary.core.ts for why the summary, not the stream, is the input.
//
// Fails open, always. On a red job a second red step here would be noise
// pointing at the reporter instead of the failure, and an exception must never
// mask the real one; on a green job it must never be what turns the build red.
// Every failure path warns and exits 0.
//
// env: GITHUB_STEP_SUMMARY (runner file; printed when unset),
//      TURBO_RUNS_DIR, TURBO_SUMMARY_SESSION (read by session.ts),
//      TURBO_SUMMARY_ARTIFACT_URL (the uploaded `--summarize` JSON, linked as
//      the uncapped copy of the capped lists this prints),
//      VITEST_ATTACHMENTS_ARTIFACT_URL (the uploaded `.vitest/` dirs, linked
//      when a failing spec wrote a screenshot or attachment),
//      CYPRESS_SCREENSHOTS_ARTIFACT_URL (the uploaded Cypress screenshots,
//      linked when an e2e suite failed),
//      A11Y_SCREENSHOTS_ARTIFACT_URL (the uploaded axe screenshots, linked
//      when the axe pass found violations),
//      TURBO_LOGS_ARTIFACT_URL (the uploaded per-task turbo logs),
//      GITHUB_RUN_ID, FORMAT_PATCH_ARTIFACT_URL (read by format-diff.ts).

import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

import {
  type FormatFinding,
  type PatchNote,
  formattingLines,
  formattingMarkdown,
  formattingTier,
} from './format-annotations.core.ts';
import { type FormattingFixes, formattingFixes } from './format-diff.ts';

import {
  type OverviewContext,
  type RunReport,
  FAILURE_SECTIONS_MAX_BYTES,
  annotationNote,
  buildReports,
  extractAnnotations,
  guardCommands,
  planAnnotations,
  sessionFailureMarkdown,
  sessionHeadline,
  sessionLines,
  sessionMarkdown,
  sessionStdoutReport,
  type ToolAnnotation,
} from './run-summary.core.ts';
import { readSession, warn } from './session.ts';
import { extractTscDiagnostics } from './tsc-annotations.core.ts';
import { errorCommand } from '@tools/shared/gha.core.ts';
import { onActions } from '@tools/shared/gha.ts';

/** Fresh per run: a log that could guess the token could escape the guard. */
function commandToken(): string | undefined {
  return onActions() ? randomUUID() : undefined;
}

async function publish(
  runs: RunReport[],
  context: OverviewContext,
  annotations: readonly ToolAnnotation[],
  formatting: readonly FormatFinding[],
  patch: PatchNote | undefined,
): Promise<void> {
  const summaries = runs.map(({ summary }) => summary);
  const allReports = runs.flatMap(({ reports }) => reports);
  const line = sessionHeadline(summaries, allReports);

  // A run's own verdict, not `reports.length`: a red run whose tasks all
  // exited 0 still needs the failure section, which is where the "turbo died
  // outside a task" wording lives. `--continue` still exits with the highest
  // task exit code, so a failing task with a zero run exit is not expected.
  const failures = runs.filter(
    ({ summary, reports }) =>
      summary.execution.exitCode !== 0 || reports.length > 0,
  );

  const failed = failures.length > 0;

  // Off Actions nothing parses them, and the note would describe nothing.
  const plan = onActions()
    ? planAnnotations(annotations, { error: failed ? 1 : 0 }, [
        formattingTier(formatting),
      ])
    : undefined;

  if (plan !== undefined) context.annotations = annotationNote(plan);
  // The failure leads on both lanes: a red build opens this step, and the
  // reader came for what broke. The overview follows as context.
  const overview = sessionMarkdown(runs, context);

  // Formatting spends what the task sections leave of one budget.
  const budget = { bytes: FAILURE_SECTIONS_MAX_BYTES };

  const markdown = failed
    ? `${sessionFailureMarkdown(failures, budget)}${formattingMarkdown(formatting, patch, budget)}\n${overview}`
    : overview;

  const file = process.env.GITHUB_STEP_SUMMARY;
  const toFile = file !== undefined && file !== '';

  // The stdout lane, ungrouped: an agent reading `gh run view --log-failed`
  // gets the excerpts inline, and a human scanning the step sees the headline
  // without expanding anything. Grouping is deliberately NOT used — a
  // collapsed group is exactly the problem this step exists to solve.
  const chunks = failed
    ? [
        ...sessionStdoutReport(failures, summaries),
        '',
        ...formattingLines(formatting, patch),
        ...sessionLines(runs, context),
        '',
      ]
    : [...sessionLines(runs, context), ''];

  // The fallback prints the same untrusted excerpts, so it goes inside the guard.
  if (!toFile) chunks.push(`\n${markdown}`);

  for (const chunk of guardCommands(chunks, commandToken())) console.log(chunk);

  // After the guard resumed: our own annotation has to be parsed. The step
  // summary file is markdown, never scanned for commands, so it needs none.
  if (toFile) await appendFile(file, markdown);

  // Rebuilt from validated fields, so these are the only commands a log can
  // cause; on green runs too, where a lint warning is the whole finding.
  for (const command of plan?.commands ?? []) console.log(command);

  // The annotation is the top-of-page pointer; the summary is the detail. Only
  // on a failure: a green run has nothing that warrants an annotation.
  if (onActions() && failed) {
    console.log(errorCommand(line));
  }
}

async function main(): Promise<void> {
  const session = await readSession();

  if (session === undefined) return;

  // No exitCode gate: the step runs on green runs too, and a red run whose
  // tasks all exited 0 — turbo itself died, or the runner timed out — is a
  // case the failure section reports rather than one to bail on.
  const annotations: ToolAnnotation[] = session.runs.flatMap(
    ({ summary, logs }) => [
      ...extractAnnotations(summary, logs, process.cwd()),
      ...extractTscDiagnostics(summary, logs, process.cwd()),
    ],
  );

  // Reports built after every log is in hand, so a task's log is available
  // whichever run of the session wrote it.
  const runs: RunReport[] = session.runs.map(({ summary, fileName }) => ({
    summary,
    fileName,
    reports: buildReports(summary, session.logs),
  }));

  // Rewritten, not read back: a local run has no format_patch step, and one
  // session always yields the same patch.
  let fixes: FormattingFixes = { findings: [], patch: undefined };

  try {
    fixes = formattingFixes(session);
  } catch (error: unknown) {
    warn(
      `no formatting findings: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const { findings: formatting, patch } = fixes;

  await publish(
    runs,
    {
      onActions: onActions(),
      // `secrets.TURBO_TOKEN != ''` from the workflow: presence only, never the value.
      remoteToken: process.env.TURBO_SUMMARY_TOKEN_SET !== 'false',
      // Set by the workflow from the upload step's `artifact-url` output; absent
      // locally, where the files this read are already on disk. Every file is
      // named: the artifact holds them all under one URL, and GitHub gives no
      // per-file link to hand out instead.
      artifactUrl: process.env.TURBO_SUMMARY_ARTIFACT_URL,
      fileNames: runs.map((run) => run.fileName ?? ''),
      attachmentsUrl: process.env.VITEST_ATTACHMENTS_ARTIFACT_URL,
      screenshotsUrl: process.env.CYPRESS_SCREENSHOTS_ARTIFACT_URL,
      a11yScreenshotsUrl: process.env.A11Y_SCREENSHOTS_ARTIFACT_URL,
      logsUrl: process.env.TURBO_LOGS_ARTIFACT_URL,
    },
    annotations,
    formatting,
    patch,
  );
}

main().catch((cause: unknown) => {
  warn(
    `run summary failed, the full step log is unaffected: ${
      cause instanceof Error ? cause.message : String(cause)
    }`,
  );
});
