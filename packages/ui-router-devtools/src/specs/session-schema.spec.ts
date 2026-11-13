import { describe, expect, it } from 'vitest';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import { sessionJsonSchema } from '../../scripts/json-schema.ts';
import { record } from '../index.ts';
import { readSession } from '../session-schema.ts';
import { fold } from '../fold.ts';
import type { Session } from '../schema.ts';

const recorded = async (): Promise<Session> => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});
  router.stateRegistry.register({ name: 'a', url: '/a/:id' });
  router.stateRegistry.register({ name: 'b', url: '/b' });

  const recorder = record(router);
  await router.stateService.go('a', { id: '1' });
  await router.stateService.go('b');
  await router.stateService.go('typo').catch(() => {});
  await router.stateService.go('a', {}, { inherit: false }).catch(() => {});
  const session = recorder.session();
  recorder.stop();
  router.dispose();

  // A file holds JSON, so a session is read the way it was written.
  // SAFETY: the parse of a stringified session
  return JSON.parse(JSON.stringify(session)) as Session;
};

describe('readSession', () => {
  it('reads an exported session back to the same model', async () => {
    const session = await recorded();
    const read = readSession(session);

    expect(read).toEqual({ ok: true, session, skipped: 0 });
    expect(read.ok && fold(read.session.events)).toEqual(fold(session.events));
  });

  it('skips and counts an event of an unknown type, and keeps unknown fields', async () => {
    const session = await recorded();

    const read = readSession({
      ...session,
      note: 'from a later v1',
      events: [
        ...session.events.map((event) =>
          event.type === 'transition' ? { ...event, extra: true } : event,
        ),
        { v: 1, seq: 999, t: 1, type: 'teleport', to: 'b' },
      ],
    });

    expect(read.ok && read.skipped).toBe(1);
    expect(read.ok && read.session.events).toHaveLength(session.events.length);
    expect(
      read.ok &&
        read.session.events.find((event) => event.type === 'transition'),
    ).toHaveProperty('extra', true);
  });

  it('falls back on an enum value it does not know', async () => {
    const session = await recorded();

    const read = readSession({
      ...session,
      events: session.events.map((event) =>
        event.type === 'result' ? { ...event, outcome: 'teleported' } : event,
      ),
    });

    expect(
      read.ok &&
        read.session.events.flatMap((event) =>
          event.type === 'result' ? [event.outcome] : [],
        ),
    ).toEqual(['aborted', 'aborted', 'aborted']);
  });

  it('refuses a file that is not a session', () => {
    expect(readSession({ name: 'package.json' })).toEqual({
      ok: false,
      error:
        "not a ui-router session file; it has no format: 'ui-router-session'.",
    });
    expect(readSession([1, 2])).toMatchObject({ ok: false });
    expect(
      readSession({ format: 'ui-router-session', v: 2, events: [] }),
    ).toEqual({
      ok: false,
      error: 'this panel reads session schema v1, and the file is v2.',
    });
    expect(
      readSession({ format: 'ui-router-session', v: 1, events: [] }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/^id: /) });
  });
});

it('generates a stable JSON Schema with no $id', async () => {
  const schema = sessionJsonSchema();

  expect(schema).not.toHaveProperty('$id');
  await expect(`${JSON.stringify(schema, null, 2)}\n`).toMatchFileSnapshot(
    './__snapshots__/session.schema.json.snap',
  );
});
