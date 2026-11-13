import { describe, expect, it } from 'vitest';

import type { RouterEvent } from '../event-schema.ts';
import {
  combineRedaction,
  redactEvent,
  redactionOf,
  redactParams,
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
