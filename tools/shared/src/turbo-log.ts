import { posix } from 'node:path';

/** Where turbo writes a task's log, repo-relative; `:` is not portable in a filename. */
export const turboLogFile = (directory: string, task: string): string =>
  posix.join(
    directory,
    '.turbo',
    `turbo-${task.replaceAll(':', '$colon$')}.log`,
  );
