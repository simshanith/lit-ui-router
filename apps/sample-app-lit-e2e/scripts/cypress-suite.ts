import { spawn } from 'node:child_process';

import { e2eUrl } from './base-url.ts';

// The Cypress suites whose baseUrl is a mount other than the base config's. The others
// (vanilla, docs, pushState) keep the base config's baseUrl and stay plain
// package.json scripts; these needed a launcher because shell can fail on an
// unset var but cannot supply one (#697).
const suites = {
  effect: { path: 'app-effect/', expose: undefined },
  mobx: { path: 'app-mobx/', expose: undefined },
  signals: { path: 'app-signals/', expose: undefined },
  hash: { path: 'app-hash/', expose: 'LOCATION_PLUGIN=hash' },
} as const;

const main = (): void => {
  const name = process.argv[2];

  if (name === undefined || !(name in suites)) {
    console.error(`usage: cypress-suite.ts <${Object.keys(suites).join('|')}>`);
    process.exitCode = 1;

    return;
  }

  // SAFETY: the `name in suites` check above returns otherwise
  const suite = suites[name as keyof typeof suites];

  const child = spawn(
    'cypress',
    [
      'run',
      '--browser',
      'chrome',
      ...(suite.expose ? ['--expose', suite.expose] : []),
      ...[
        '--config',
        [
          `baseUrl=${e2eUrl(suite.path)}`,
          `videosFolder=cypress/videos-${name}`,
          `screenshotsFolder=cypress/screenshots-${name}`,
        ].join(','),
      ],
    ],
    { stdio: 'inherit' },
  );

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
};

if (import.meta.main) main();
