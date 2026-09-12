import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AppModules } from '../global/appModules.js';
import { registerAppModules } from '../global/appModules.js';
import type { Message } from './interface.js';
import { MessageTable } from './MessageTable.js';

// MessageTable reads the late-bound AppConfig.sort
registerAppModules({
  AppConfig: { sort: '-date' },
} as unknown as AppModules);

const message = (_id: string, subject: string): Message => ({
  _id,
  read: false,
  from: 'somebody@somewhere.com',
  to: 'myself@angular.dev',
  date: '2015-11-15T00:00:00.000Z',
  subject,
  body: subject,
});

const unreadRows = (table: MessageTable) =>
  [...table.querySelectorAll('tbody tr')].filter((row) =>
    row.querySelector('td i.fa-circle'),
  ).length;

describe('message table read column', () => {
  let table: MessageTable;
  let messages: Message[];

  beforeEach(async () => {
    messages = [message('a', 'First'), message('b', 'Second')];
    table = new MessageTable();
    table.columns = ['read', 'from', 'subject', 'date'];
    table.messages = messages;
    document.body.append(table);
    await table.updateComplete;
  });

  afterEach(() => {
    table.remove();
  });

  it('renders a dot for every unread message', () => {
    expect(unreadRows(table)).toBe(2);
  });

  // sample-message mutates the shared instance, then the list re-assigns the same array
  it('drops the dot when a row is marked read in place', async () => {
    messages[0].read = true;
    table.messages = messages;
    await table.updateComplete;

    expect(unreadRows(table)).toBe(1);
  });
});
