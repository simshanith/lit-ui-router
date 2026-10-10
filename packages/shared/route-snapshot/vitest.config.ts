import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';

export default defineConfig({
  test: {
    name: 'route-snapshot',
    environment: 'node',
    include: ['src/specs/**/*.spec.ts'],
    // github-actions precedes the failure banner
    reporters: [
      ...(process.env.GITHUB_ACTIONS === 'true'
        ? [new GithubActionsReporter({ jobSummary: { enabled: false } })]
        : []),
      'default',
    ],
  },
});
