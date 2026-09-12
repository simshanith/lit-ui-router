import { describe, it, expect } from 'vitest';
import type { Message } from './interface.js';
import { snapshot } from './snapshot.js';

const message = (_id: string): Message => ({
  _id,
  read: false,
  from: 'somebody@somewhere.com',
  to: 'myself@angular.dev',
  date: '2015-11-15T00:00:00.000Z',
  subject: _id,
  body: _id,
});

describe('message list snapshot', () => {
  const rows = [message('a'), message('b')];
  const taken = snapshot(rows);

  it('copies the rows by value', () => {
    expect(taken).toEqual(rows);
  });

  it('clones the array and every row', () => {
    expect(taken).not.toBe(rows);
    taken.forEach((row, index) => expect(row).not.toBe(rows[index]));
  });

  it('freezes the array and every row', () => {
    expect(Object.isFrozen(taken)).toBe(true);
    taken.forEach((row) => expect(Object.isFrozen(row)).toBe(true));
  });

  it('throws if the list side writes to a row', () => {
    expect(() => {
      taken[0].read = true;
    }).toThrow(TypeError);
  });

  it('leaves the source rows alone', () => {
    expect(rows[0].read).toBe(false);
    expect(Object.isFrozen(rows[0])).toBe(false);
  });
});
