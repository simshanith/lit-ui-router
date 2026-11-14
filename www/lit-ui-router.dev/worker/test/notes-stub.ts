// Fixture release notes, as the docs build writes them, for the node and workerd tests.
import type { NotesReader, ReleaseNotes } from '../releases/notes.ts';

/** lit-ui-router's notes: 1.9.0 has no section, and 1.12.0 has one the ledger does not list yet. */
export const FIXTURE_NOTES = {
  'lit-ui-router': {
    '1.12.0': { date: '2030-01-01', html: '<p>Not released yet.</p>\n' },
    '1.10.0': {
      date: '2026-03-02',
      html: '<h3>Features</h3>\n<ul>\n<li>add <code>uiViewProps</code></li>\n</ul>\n<details><summary>Also touched (1)</summary>\n<p>docs</p>\n</details>\n',
    },
    '1.2.0': {
      date: '2025-01-01',
      html: '<h3>Bug Fixes</h3>\n<ul>\n<li>first fix</li>\n</ul>\n',
    },
  },
} as const satisfies Readonly<Record<string, ReleaseNotes>>;

const byName = new Map<string, ReleaseNotes>(Object.entries(FIXTURE_NOTES));

/** The fixture notes; a package without any reads as none. */
export const fixtureNotes: NotesReader = (name) =>
  Promise.resolve(byName.get(name) ?? {});

/** A reader for routes that must not read notes. */
export const unreadNotes: NotesReader = (name) =>
  Promise.reject(new Error(`read ${name}'s notes`));
