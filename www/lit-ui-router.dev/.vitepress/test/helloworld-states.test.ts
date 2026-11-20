import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  HELLO_WORLD_INITIAL,
  HELLO_WORLD_STATES,
  stateForHash,
} from '../theme/components/helloworld-states.ts';

// main.ts starts a router on import, so its state literals are read as text.
const source = readFileSync(
  join(import.meta.dirname, '../../../../examples/helloworld/src/main.ts'),
  'utf8',
);

const declared = [...source.matchAll(/name: '([^']+)',\s+url: '([^']+)'/g)].map(
  ([, name, url]) => ({ name, url }),
);

describe('home page diagram states', () => {
  it('draws the states the Hello World example registers, with their URLs', () => {
    assert.deepEqual(
      HELLO_WORLD_STATES.map(({ name, url }) => ({ name, url })),
      declared,
    );
  });

  it('starts on the state the example makes initial', () => {
    assert.ok(
      source.includes(`rules.initial({ state: '${HELLO_WORLD_INITIAL}' })`),
    );
  });

  it('shows markup each state component renders', () => {
    const markup = source.replaceAll(/\s+/g, ' ');

    for (const { renders, more } of HELLO_WORLD_STATES)
      assert.ok(
        markup.includes(more ? `${renders} <` : `${renders}\``),
        `${renders} is not what main.ts renders`,
      );
  });

  it('reads the active state from the embed hash', () => {
    assert.equal(stateForHash('#/about'), 'about');
    assert.equal(stateForHash('#/hello'), 'hello');
    assert.equal(stateForHash(''), undefined);
  });
});
