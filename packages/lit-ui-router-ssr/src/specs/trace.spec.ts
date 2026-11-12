import { trace } from '@uirouter/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../register.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { makeRouter, rootTemplate } from './fixture.js';
import { bootAt, draw, serve, withoutSignature } from './round-trip.js';

const drawShell = (path: string): Promise<string> =>
  draw(rootTemplate, [UiViewRenderer], path);

/** The lines `console.log` received that start with `prefix`. */
const linesStarting = (
  log: { mock: { calls: readonly (readonly unknown[])[] } },
  prefix: RegExp,
): string[] =>
  log.mock.calls
    .map(([line]) => line)
    .filter((line): line is string => typeof line === 'string')
    .filter((line) => prefix.test(line));

const adoptLine = /^ui-view: (Adopted|Fell back|Rendered cold) /;

afterEach(() => {
  trace.disable();
  document.body.replaceChildren();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('tracing hydration', () => {
  it('logs nothing with the trace off', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));

    await bootAt(container, rootTemplate, '/shell/detail');

    expect(log).not.toHaveBeenCalled();
  });

  it('logs each served view once under UIVIEW, in production too', async () => {
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    trace.enable('UIVIEW');

    await bootAt(container, rootTemplate, '/shell');

    expect(linesStarting(log, adoptLine)).toEqual([
      expect.stringMatching(
        /^ui-view: Adopted {24}\[ui-view#\d+ lit:\$default \(\$default@\(root\)\)\] for state='shell'$/,
      ),
      expect.stringMatching(
        /^ui-view: Fell back {22}\[ui-view#\d+ lit:\$default\.\$default \(\$default@shell\)\], cause: Error: /,
      ),
    ]);
    expect(linesStarting(log, /^bootstrap: /)).toEqual([]);
  });

  it('logs the boot comparison once under TRANSITION', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    trace.enable('TRANSITION');

    await bootAt(container, rootTemplate, '/shell/detail');

    expect(linesStarting(log, /^bootstrap: /)).toEqual([
      "bootstrap: adopted, signature matched (drawn for 'shell.detail', booted into 'shell.detail'), views: $default=adopted $default.$default=adopted",
    ]);
    expect(linesStarting(log, adoptLine)).toEqual([]);
  });

  it('logs a cold boot with no signature under TRANSITION', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { container } = serve(
      withoutSignature(await drawShell('/shell/detail')),
    );

    trace.enable('TRANSITION');

    await bootAt(container, rootTemplate, '/shell/detail');

    expect(linesStarting(log, /^bootstrap: /)).toEqual([
      "bootstrap: cold, signature absent (booted into 'shell.detail')",
    ]);
  });

  it('logs a failed boot with its rejection under TRANSITION', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container } = serve(await drawShell('/shell/detail'));
    const router = makeRouter();
    router.transitionService.onBefore({ to: 'shell.detail' }, () => false);
    trace.enable('TRANSITION');

    await bootAt(container, rootTemplate, '/shell/detail', {}, router);

    expect(linesStarting(log, /^bootstrap: /)).toEqual([
      expect.stringMatching(
        /^bootstrap: cold, signature elsewhere \(drawn for 'shell\.detail', booted into '\(root\)'\), error: .*aborted/i,
      ),
    ]);
  });
});
