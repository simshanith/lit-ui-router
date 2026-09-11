import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';
import { spawn } from 'node:child_process';

// The two Cypress suites whose baseUrl carries the dev-server port. The others
// (vanilla, docs, pushState) keep the base config's baseUrl and stay plain
// package.json scripts; these needed a launcher because shell can fail on an
// unset var but cannot supply one (#697).
const suites = {
  mobx: { path: 'app-mobx/', expose: undefined },
  hash: { path: 'app-hash/', expose: 'LOCATION_PLUGIN=hash' },
} as const;

const name = process.argv[2];
if (name === undefined || !(name in suites)) {
  console.error(`usage: cypress-suite.ts <${Object.keys(suites).join('|')}>`);
  process.exit(1);
}

const suite = suites[name as keyof typeof suites];
const port = resolveWwwDevPort();
const child = spawn(
  'cypress',
  [
    'run',
    ...(suite.expose ? ['--expose', suite.expose] : []),
    ...[
      '--config',
      [
        `baseUrl=http://localhost:${port}/${suite.path}`,
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
