import { describe, it, expect } from 'vitest';
import type { Message } from './interface.js';
import { orderBy } from './messageListUIService.js';
import { outgoingMessage } from './outgoing.js';

const message = (_id: string, date: string): Message => ({
  _id,
  read: false,
  from: 'myself@angular.dev',
  to: 'somebody@somewhere.com',
  date,
  subject: _id,
  body: _id,
});

describe('outgoing message', () => {
  const now = new Date('2026-10-09T12:00:00.000Z');

  it('stamps the date as an ISO string', () => {
    const sent = outgoingMessage(message('new', ''), 'sent', now);

    expect(sent.date).toBe('2026-10-09T12:00:00.000Z');
    expect(sent).toMatchObject({ read: true, folder: 'sent' });
  });

  it('keeps the same value through the storage JSON round trip', () => {
    const draft = outgoingMessage(message('new', ''), 'drafts', now);

    expect(JSON.parse(JSON.stringify(draft))).toEqual(draft);
  });

  it('sorts by date among the fixture messages', () => {
    const rows = [
      outgoingMessage(message('new', ''), 'sent', now),
      message('old', '2015-11-15T00:00:00.000Z'),
      message('older', '2015-11-14T00:00:00.000Z'),
    ];

    expect(rows.sort(orderBy('+date')).map(({ _id }) => _id)).toEqual([
      'older',
      'old',
      'new',
    ]);
  });
});
