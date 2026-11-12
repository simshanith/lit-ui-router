import type { StateDeclaration, UIRouter } from '@uirouter/core';
import { goQuietly } from './sequence.ts';

const TOP = [
  'accounts',
  'billing',
  'catalog',
  'dashboard',
  'events',
  'files',
  'groups',
  'help',
  'inbox',
  'jobs',
  'keys',
  'labels',
  'members',
  'notes',
  'orders',
  'people',
  'queues',
  'reports',
  'settings',
  'teams',
];

export const LONG_SEGMENT = 'quarterlyReconciliationWorksheetOverview';

const NESTED = [
  'accounts.list',
  'accounts.detail',
  'accounts.detail.edit',
  'accounts.detail.history',
  'billing.invoices',
  'billing.invoices.invoice',
  'billing.methods',
  'catalog.items',
  'catalog.items.item',
  'catalog.items.item.variants',
  'catalog.categories',
  'events.calendar',
  'events.event',
  'files.folder',
  'files.folder.file',
  'files.folder.file.preview',
  'inbox.thread',
  'inbox.thread.message',
  'jobs.queue',
  'jobs.queue.run',
  'jobs.queue.run.log',
  'orders.archive',
  'orders.archive.year',
  'orders.archive.year.month',
  'orders.archive.year.month.day',
  'orders.archive.year.month.day.entry',
  'orders.open',
  'orders.open.detail',
  `reports.${LONG_SEGMENT}`,
  `reports.${LONG_SEGMENT}.chart`,
  'reports.daily',
  'reports.weekly',
  'reports.monthly',
  'settings.profile',
  'settings.security',
  'settings.security.sessions',
  'settings.notifications',
  'teams.team',
  'teams.team.members',
  'teams.team.roles',
];

export const STRESS_DEEPEST = 'orders.archive.year.month.day.entry';

// A tree that exercises the nested Map's fit ladder: 60 states, six levels, a 40-character segment, 20 top-level siblings.
export const stressStates = (): StateDeclaration[] =>
  [...TOP, ...NESTED].map((name) => ({
    name,
    url: `/${name.slice(name.lastIndexOf('.') + 1)}`,
  }));

export const stressSequence = async (router: UIRouter): Promise<void> => {
  for (const state of [
    'dashboard',
    STRESS_DEEPEST,
    `reports.${LONG_SEGMENT}.chart`,
    'settings.security.sessions',
    STRESS_DEEPEST,
  ])
    await goQuietly(router, state);
};
