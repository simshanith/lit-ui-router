import { describe, expect, it } from 'vitest';

import type { RouterEvent, Session } from '../event-schema.ts';
import {
  combineRedaction,
  redactEvent,
  redactionOf,
  redactParams,
  redactSession,
  redactSpan,
} from '../redaction.ts';

describe('redactParams', () => {
  const params = { id: '7', email: 'a@b.c', tags: ['x'], unset: null };

  it('keeps the keys and redacts every value not allowlisted', () => {
    expect(redactParams(params, ['id'])).toEqual({
      id: '7',
      email: '[redacted]',
      tags: '[redacted]',
      unset: null,
    });
  });

  it('keeps every value under all', () => {
    expect(redactParams(params, 'all')).toBe(params);
  });
});

describe('redactEvent', () => {
  const result: RouterEvent = {
    v: 1,
    seq: 4,
    t: 1,
    type: 'result',
    id: 2,
    outcome: 'invalid',
    message: 'contains user data',
    invalidParams: ['id'],
  };

  it('drops messages when they are not kept and leaves invalidParams', () => {
    expect(redactEvent(result, { params: 'all', messages: false })).toEqual({
      v: 1,
      seq: 4,
      t: 1,
      type: 'result',
      id: 2,
      outcome: 'invalid',
      invalidParams: ['id'],
    });
  });

  it('keeps an event whose type it does not scrub', () => {
    const phase: RouterEvent = {
      v: 1,
      seq: 1,
      t: 0,
      type: 'phase',
      id: 0,
      phase: 'enter',
      edge: 'start',
      state: 'a',
    };

    expect(redactEvent(phase, redactionOf())).toBe(phase);
  });
});

describe('combineRedaction', () => {
  it('keeps only what both redactions keep', () => {
    expect(
      combineRedaction(
        { params: ['a', 'b'], messages: true },
        { params: ['b', 'c'], messages: false },
      ),
    ).toEqual({ params: ['b'], messages: false });
    expect(
      combineRedaction(
        { params: 'all', messages: true },
        { params: ['a'], messages: true },
      ),
    ).toEqual({ params: ['a'], messages: true });
  });

  it('defaults to keys without values, and messages kept', () => {
    expect(redactionOf()).toEqual({ params: [], messages: true });
    expect(redactionOf({ params: 'all' })).toEqual({
      params: 'all',
      messages: true,
    });
  });
});

describe('redactEvent params', () => {
  const keepId = { params: ['id'], messages: true } as const;
  const base = { v: 1, seq: 1, t: 0 } as const;

  it('redacts both ends of a transition', () => {
    const transition: RouterEvent = {
      ...base,
      type: 'transition',
      id: 0,
      from: 'a',
      to: 'b',
      fromParams: { id: '1', q: 'from' },
      toParams: { id: '2', q: 'to' },
      entering: ['b'],
      exiting: ['a'],
      retained: [],
      redirectedFrom: null,
      options: {
        source: 'unknown',
        location: true,
        reload: false,
        inherit: true,
        supercede: true,
      },
      dynamic: false,
    };

    expect(redactEvent(transition, keepId)).toMatchObject({
      fromParams: { id: '1', q: '[redacted]' },
      toParams: { id: '2', q: '[redacted]' },
    });
  });

  it("redacts an invalid target's params and the current params", () => {
    expect(
      redactEvent(
        {
          ...base,
          type: 'invalid',
          from: 'a',
          to: 'typo',
          toParams: { id: '1', q: 'x' },
        },
        keepId,
      ),
    ).toMatchObject({ toParams: { id: '1', q: '[redacted]' } });

    expect(
      redactEvent(
        { ...base, type: 'current', name: 'b', params: { id: '1', q: 'x' } },
        keepId,
      ),
    ).toMatchObject({ params: { id: '1', q: '[redacted]' } });
  });

  it("drops a failed resolve's message only when messages are not kept", () => {
    const resolve: RouterEvent = {
      ...base,
      type: 'resolve',
      id: 0,
      token: 'user',
      state: 'b',
      start: 0,
      end: 1,
      ok: false,
      cached: false,
      message: 'no user 7',
    };

    expect(redactEvent(resolve, keepId)).toBe(resolve);
    expect(
      redactEvent(resolve, { params: 'all', messages: false }),
    ).not.toHaveProperty('message');
  });
});

describe('redactSession', () => {
  it('redacts every event and records the stricter of the two redactions', () => {
    const session: Session = {
      format: 'ui-router-session',
      v: 1,
      id: 'session-1',
      generator: { name: 'test', version: '0.0.0' },
      routerId: 'router-1',
      timeOrigin: 0,
      t: 1,
      dropped: 0,
      timeResolves: false,
      redaction: { params: ['id', 'q'], messages: true },
      events: [
        {
          v: 1,
          seq: 1,
          t: 0,
          type: 'current',
          name: 'b',
          params: { id: '1', q: 'x' },
        },
      ],
    };

    expect(
      redactSession(session, { params: ['q'], messages: false }),
    ).toMatchObject({
      redaction: { params: ['q'], messages: false },
      events: [{ params: { id: '[redacted]', q: 'x' } }],
    });
  });
});

describe('redactSpan', () => {
  const span = {
    traceId: 't',
    spanId: 's',
    name: 'HTTP GET',
    startTime: 1,
    endTime: 2,
    attributes: {
      'url.full': 'https://example.test/users/7?token=x',
      'http.response.status_code': 200,
      'uirouter.transition_id': 3,
      'uirouter.to': 'users.user',
      'uirouter.param.userId': '7',
      'uirouter.param.q': 'x',
    },
  };

  it("keeps the router's own attributes and the allowlisted params, and redacts every other value", () => {
    expect(redactSpan(span, { params: ['userId'], messages: true })).toEqual({
      ...span,
      attributes: {
        'url.full': '[redacted]',
        'http.response.status_code': '[redacted]',
        'uirouter.transition_id': 3,
        'uirouter.to': 'users.user',
        'uirouter.param.userId': '7',
        'uirouter.param.q': '[redacted]',
      },
    });
  });

  it('keeps every value under all, and a span without attributes as it is', () => {
    expect(redactSpan(span, { params: 'all', messages: true })).toBe(span);

    const bare = { traceId: 't', spanId: 'b', name: 'b', startTime: 0 };

    expect(redactSpan(bare, redactionOf())).toBe(bare);
  });

  it('applies to the spans of a session, and leaves a session without spans without the field', () => {
    const session: Session = {
      format: 'ui-router-session',
      v: 1,
      id: 'session-1',
      generator: { name: 'test', version: '0.0.0' },
      routerId: 'router-1',
      timeOrigin: 0,
      t: 1,
      dropped: 0,
      timeResolves: false,
      redaction: { params: 'all', messages: true },
      events: [],
    };

    expect(redactSession(session, redactionOf())).not.toHaveProperty('spans');
    expect(
      redactSession({ ...session, spans: [span] }, redactionOf()).spans?.[0]
        ?.attributes,
    ).toMatchObject({ 'url.full': '[redacted]', 'uirouter.to': 'users.user' });
  });
});
