// The one state the home page diagram draws and its param's values; test/features-tour-states.test.ts holds them to examples/features-tour/src.
export const CARD_STATE = {
  name: 'card',
  url: '/:cardId',
  param: 'cardId',
} as const;

/** The home page's feature cards, in the example's order. */
export const CARD_IDS = ['states', 'views', 'resolves'] as const;

export type CardId = (typeof CARD_IDS)[number];

/** The card the tour opens on when the fragment names none. */
export const INITIAL_CARD: CardId = 'states';

/** The tour section's id, and the prefix of its state fragments: `#see-it-run` is the section, `#see-it-run/views` the section showing a card. */
export const TOUR_LANDMARK = 'see-it-run';

/** The fragment that opens the tour on a card. */
export function hashForCard(id: CardId): string {
  return `#${TOUR_LANDMARK}${CARD_STATE.url.replace(`:${CARD_STATE.param}`, id)}`;
}

/** The card a fragment names in its plain form; the diagram's first guess, before the app's router reports the card it entered. */
export function cardForHash(hash: string): CardId | undefined {
  return CARD_IDS.find((id) => hash === hashForCard(id));
}
