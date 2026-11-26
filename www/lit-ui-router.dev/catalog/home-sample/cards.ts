// The data and view the home page's sample app routes to; app.ts beside it is the listing.
import type { RawParams } from '@uirouter/core';
import { html, type TemplateResult } from 'lit';

/** A feature card, as the features tour pages through them. */
export interface Card {
  id: string;
  title: string;
}

const CARDS: readonly Card[] = [
  { id: 'states', title: 'States' },
  { id: 'views', title: 'Views' },
  { id: 'resolves', title: 'Resolves' },
];

/** A param as the router hands it over: core types its values loosely, and the listing passes one straight in, as the tutorials do. */
type ParamValue = RawParams[string];

/** The card a `cardId` param names, or the first card when it names none. */
export const cardFor = (id: ParamValue): Card =>
  CARDS.find((card) => card.id === id) ?? CARDS[0];

export const cardView = (card: Card): TemplateResult =>
  html`<h2>${card.title}</h2>`;
