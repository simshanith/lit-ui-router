// node:test's spec reporter, plus an `::error` per failing test when GITHUB_ACTIONS is set.
import { relative } from 'node:path';
import { finished } from 'node:stream/promises';
import { spec, type TestEvent } from 'node:test/reporters';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { annotationCommand } from './gha.core.ts';

type TestFail = Extract<TestEvent, { type: 'test:fail' }>['data'];

// The runner's wrapper around what a test threw.
interface TestFailure extends Error {
  code?: string;
  failureType?: string;
}

// `at fn (file:///a/b.ts:5:10)` and `at /a/b.ts:5:10`
const FRAME = /\(?((?:file:\/\/)?\/[^()\s]*):(\d+):(\d+)\)?$/;

// Failures that only echo another test's failure.
const ECHOES = new Set(['subtestsFailed', 'cancelledByParent']);

function toPath(file: string): string {
  return file.startsWith('file://') ? fileURLToPath(file) : file;
}

/** The innermost frame of `stack` that lies in `file`. */
export function frameIn(
  stack: string,
  file: string,
): { line: number; col: number } | undefined {
  for (const line of stack.split('\n')) {
    const match = FRAME.exec(line.trim());

    if (match?.[1] !== undefined && toPath(match[1]) === file) {
      return { line: Number(match[2]), col: Number(match[3]) };
    }
  }

  return undefined;
}

/** The `::error` command for one failing test, relative to `cwd`. */
export function failureAnnotation(
  data: TestFail,
  cwd: string,
): string | undefined {
  const error: TestFailure = data.details.error;

  if (data.file === undefined) return undefined;

  if (ECHOES.has(error.failureType ?? '')) return undefined;

  const cause: unknown =
    error.code === 'ERR_TEST_FAILURE' ? error.cause : error;

  const file = toPath(data.file);

  const frame =
    (cause instanceof Error ? frameIn(cause.stack ?? '', file) : undefined) ??
    (data.line === undefined ? {} : { line: data.line, col: data.column });

  const message = stripVTControlCharacters(
    cause instanceof Error ? cause.message : String(cause),
  ).trim();

  return annotationCommand('error', message || data.name, {
    file: relative(cwd, file),
    ...frame,
    title: data.name,
  });
}

export default async function* githubSpec(
  source: AsyncIterable<TestEvent>,
): AsyncGenerator<string> {
  const annotate = process.env.GITHUB_ACTIONS === 'true';
  const formatter = spec();
  formatter.setEncoding('utf8');
  const chunks: string[] = [];
  formatter.on('data', (chunk: string) => chunks.push(chunk));

  for await (const event of source) {
    if (annotate && event.type === 'test:fail') {
      const command = failureAnnotation(event.data, process.cwd());

      if (command !== undefined) yield `${command}\n`;
    }

    formatter.write(event);
    yield* chunks.splice(0);
  }

  formatter.end();
  await finished(formatter);
  yield* chunks.splice(0);
}
