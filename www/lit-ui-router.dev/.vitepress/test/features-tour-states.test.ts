import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CARD_IDS,
  CARD_STATE,
  cardForHash,
  INITIAL_CARD,
} from '../theme/components/features-tour-states.ts';

// main.ts starts a router on import, so its literals are read as text.
const source = readFileSync(
  join(import.meta.dirname, '../../../../examples/features-tour/src/main.ts'),
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
        `rules\\.initial\\(\\{\\s+state: '${CARD_STATE.name}',\\s+params: \\{ ${CARD_STATE.param}: '${INITIAL_CARD}' \\},`,
      ),
    );
  });

  it('reads the active card from the embed hash', () => {
    assert.equal(cardForHash('#/views'), 'views');
    assert.equal(cardForHash('#/resolves'), 'resolves');
    assert.equal(cardForHash('#/nope'), undefined);
    assert.equal(cardForHash(''), undefined);
  });
});
