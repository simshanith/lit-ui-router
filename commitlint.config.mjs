// Commit-level companion to the semantic-pr.yml PR-title lint.
// config-conventional's type-enum already matches the PR-title type list.
export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    // Hand-typed freshen merges ("merge main into <branch>"); the default
    // ignores only match GitHub's capitalized "Merge branch ..." wording.
    (message) => /^merge\s+\S+\s+into\s+\S+/i.test(message),
  ],
};
