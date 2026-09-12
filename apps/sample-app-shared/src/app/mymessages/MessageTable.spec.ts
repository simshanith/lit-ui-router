import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AppModules } from '../global/appModules.js';
import { registerAppModules } from '../global/appModules.js';
import type { Message } from './interface.js';
import { MessageTable } from './MessageTable.js';
import { snapshot } from './snapshot.js';

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
  let rows: Message[];

  beforeEach(async () => {
    rows = [message('a', 'First'), message('b', 'Second')];
    table = new MessageTable();
    table.columns = ['read', 'from', 'subject', 'date'];
    table.messages = snapshot(rows);
    document.body.append(table);
    await table.updateComplete;
  });

  afterEach(() => {
    table.remove();
  });

  it('renders a dot for every unread message', () => {
    expect(unreadRows(table)).toBe(2);
  });

  // the list re-snapshots off the store commit, so the table sees a new array
  it('drops the dot when a fresh snapshot marks a row read', async () => {
    rows[0].read = true;
    table.messages = snapshot(rows);
    await table.updateComplete;

    expect(unreadRows(table)).toBe(1);
  });

  it('renders no dots once every row is read', async () => {
    table.messages = snapshot(rows.map((row) => ({ ...row, read: true })));
    await table.updateComplete;

    expect(unreadRows(table)).toBe(0);
  });
});
