import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  FEATURES_TOUR_INITIAL,
  FEATURES_TOUR_STATES,
  NESTED_VIEW_HOST,
  RESOLVE_TOKEN,
  stateForHash,
} from '../theme/components/features-tour-states.ts';

// main.ts starts a router on import, so its state literals are read as text.
const source = readFileSync(
  join(import.meta.dirname, '../../../../examples/features-tour/src/main.ts'),
  'utf8',
);

const declared = [
  ...source.matchAll(/name: '([\w.]+)',\s+url: '([\w/]+)'/g),
].map(([, name, url]) => ({ name, url }));

describe('home page diagram states', () => {
  it('draws the states the features tour registers, with their URLs', () => {
    assert.deepEqual(
      FEATURES_TOUR_STATES.map(({ name, url }) => ({ name, url })),
      declared,
    );
  });

  it("joins a child's URL to its parent's, as the dotted name nests it", () => {
    for (const { name, url, path, parent, top } of FEATURES_TOUR_STATES) {
      const above = FEATURES_TOUR_STATES.find((s) => s.name === parent);

      assert.equal(name.split('.').slice(0, -1).join('.'), parent);
      assert.equal(name.split('.')[0], top);
      assert.equal(path, `${above?.path ?? ''}${url}`);
    }
  });

  it('starts on the state the example makes initial', () => {
    assert.ok(
      source.includes(`rules.initial({ state: '${FEATURES_TOUR_INITIAL}' })`),
    );
  });

  it('names the component that holds the nested view, and the resolve token', () => {
    const host = source.indexOf(`@customElement('${NESTED_VIEW_HOST}')`);

    assert.ok(host >= 0, `no <${NESTED_VIEW_HOST}> in main.ts`);
    assert.ok(source.indexOf('<ui-view>', host) > host);
    assert.ok(source.includes(`component: NestedPage`));
    assert.ok(source.includes(`token: '${RESOLVE_TOKEN}'`));
  });

  it('reads the active state from the embed hash', () => {
    assert.equal(stateForHash('#/nested/child'), 'nested.child');
    assert.equal(stateForHash('#/nested'), 'nested');
    assert.equal(stateForHash('#/resolves'), 'resolves');
    assert.equal(stateForHash('#/child'), undefined);
    assert.equal(stateForHash(''), undefined);
  });
});
