// The one state the home page diagram draws and its param's values; test/features-tour-states.test.ts holds them to examples/features-tour/src/main.ts.
export const CARD_STATE = {
  name: 'card',
  url: '/:cardId',
  param: 'cardId',
} as const;

/** The home page's feature cards, in the example's order. */
export const CARD_IDS = ['states', 'views', 'resolves'] as const;

export type CardId = (typeof CARD_IDS)[number];

/** The card rules.initial names, shown until the embed reports another. */
export const INITIAL_CARD: CardId = 'states';

/** The example uses hashLocationPlugin, so the frame's hash is `#/<cardId>`. */
export function cardForHash(hash: string): CardId | undefined {
  return CARD_IDS.find((id) => hash === `#/${id}`);
}
