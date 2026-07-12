// Pure formatting for GitHub Actions workflow commands and step outputs.
// Collapsing multi-step jobs into single `mise run` steps moves the step-name
// structure into the log itself, so the tools emit
// ::group::/::endgroup::/::error:: to keep collapsed steps readable, and
// export step outputs via GITHUB_OUTPUT. The IO (stdout, appending to the
// outputs file) lives in gha.ts.

// Escaping per actions/toolkit's command.ts: workflow-command DATA escapes
// %, \r, \n so a multi-line message stays one ::error:: line.
function escapeData(value: string): string {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

/** `::group::<title>` — opens a collapsible log section. */
export function groupCommand(title: string): string {
  return `::group::${escapeData(title)}`;
}

/** `::endgroup::` — closes the current collapsible log section. */
export function endGroupCommand(): string {
  return '::endgroup::';
}

/** `::error::<message>` — surfaces a red annotation on the run. */
export function errorCommand(message: string): string {
  return `::error::${escapeData(message)}`;
}

// GITHUB_OUTPUT names: the runner accepts more, but our outputs are
// hand-named identifiers — reject anything else early.
const OUTPUT_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * One `name=value` line for the GITHUB_OUTPUT file. Multi-line values need
 * the heredoc delimiter syntax; every value this pipeline exports (package
 * names, directories, tarball paths, versions) is single-line by contract,
 * so a newline here is a bug — reject it instead of corrupting the file.
 */
export function outputLine(name: string, value: string): string {
  if (!OUTPUT_NAME.test(name)) {
    throw new Error(`invalid output name ${JSON.stringify(name)}`);
  }
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `output ${name} must be single-line, got ${JSON.stringify(value)}`,
    );
  }
  return `${name}=${value}`;
}
