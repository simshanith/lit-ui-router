import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CARD_IDS,
  CARD_STATE,
  cardForHash,
  hashForCard,
  INITIAL_CARD,
  TOUR_LANDMARK,
} from '../theme/components/features-tour-states.ts';

// tour.ts defines a custom element on import, so its literals are read as text.
const source = readFileSync(
  join(import.meta.dirname, '../../../../examples/features-tour/src/tour.ts'),
  'utf8',
);

describe('home page diagram state', () => {
  it('draws the one state the features tour registers, with its URL', () => {
    const declared = [
      ...source.matchAll(/name: '([\w.]+)',\s+url: '([\w/:]+)'/g),
    ].map(([, name, url]) => ({ name, url }));

    assert.deepEqual(declared, [
      { name: CARD_STATE.name, url: CARD_STATE.url },
    ]);
    assert.ok(CARD_STATE.url.endsWith(`:${CARD_STATE.param}`));
  });

  it('lists the cards the example pages through, in order', () => {
    const ids = [...source.matchAll(/^ {4}id: '([\w-]+)',$/gm)].map(
      ([, id]) => id,
    );

    assert.deepEqual(ids, [...CARD_IDS]);
  });

  it('starts on the card the example makes initial', () => {
    assert.match(
      source,
      new RegExp(
        `INITIAL_CARD = \\{\\s+state: '${CARD_STATE.name}',\\s+params: \\{ ${CARD_STATE.param}: '${INITIAL_CARD}' \\},`,
      ),
    );
  });

  it("links each card by the section's id and the card's URL", () => {
    for (const id of CARD_IDS) {
      assert.equal(
        hashForCard(id),
        `#${TOUR_LANDMARK}${CARD_STATE.url.replace(`:${CARD_STATE.param}`, id)}`,
      );
      assert.equal(cardForHash(hashForCard(id)), id);
    }
  });

  it("reads the active card from the page's hash, and none from its own anchors", () => {
    assert.equal(cardForHash('#see-it-run/views'), 'views');
    assert.equal(cardForHash('#see-it-run/resolves'), 'resolves');
    assert.equal(cardForHash('#see-it-run/nope'), undefined);
    assert.equal(cardForHash('#see-it-run'), undefined);
    assert.equal(cardForHash('#/views'), undefined);
    assert.equal(cardForHash(''), undefined);
  });
});
