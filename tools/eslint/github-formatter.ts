// ESLint's stylish output, plus a workflow command per message when GITHUB_ACTIONS is set.
import { relative } from 'node:path';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { annotationCommand } from '@tools/shared/gha.core.ts';
import { ESLint } from 'eslint';

/** One `::error`/`::warning` per message, `file` relative to `root`. */
export function annotations(
  results: readonly ESLint.LintResult[],
  root: string,
): string[] {
  return results.flatMap(({ filePath, messages }) =>
    messages.map((message) =>
      annotationCommand(
        message.severity === 2 ? 'error' : 'warning',
        message.message,
        {
          file: relative(root, filePath),
          line: message.line || undefined,
          col: message.column || undefined,
          endLine: message.endLine,
          endColumn: message.endColumn,
          title: message.ruleId ?? undefined,
        },
      ),
    ),
  );
}

const githubStylish: ESLint.FormatterFunction = async (results, context) => {
  const stylish = await new ESLint({ cwd: context.cwd }).loadFormatter(
    'stylish',
  );

  const output = await stylish.format(results, context);

  if (process.env.GITHUB_ACTIONS !== 'true') return output;

  const commands = annotations(results, workspaceRoot);

  return commands.length === 0 ? output : `${output}\n${commands.join('\n')}`;
};

export default githubStylish;
