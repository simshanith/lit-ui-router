// The bot git identity bump-version.yml and publish-gh.yml both configured
// with duplicate inline bash — now one task. Pure argv here; the IO (and the
// CI guard) lives in release-git-user.ts.

/** The two `git config --global` invocations, verbatim from the workflows. */
export function gitUserConfigArgs(): string[][] {
  return [
    ['config', '--global', 'user.name', 'github-actions[bot]'],
    [
      'config',
      '--global',
      'user.email',
      'github-actions[bot]@users.noreply.github.com',
    ],
  ];
}
