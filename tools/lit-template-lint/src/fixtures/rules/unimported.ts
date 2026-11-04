import { html } from 'lit';

import type { RuleCard } from './card.js';

export type Card = RuleCard;

export const unimported = [
  // expect missing-import
  html`<rule-card></rule-card>`,
  // a suppressed finding needs no import
  html`<!-- @ts-expect-error --><rule-header slot="header"></rule-header>`,
];
