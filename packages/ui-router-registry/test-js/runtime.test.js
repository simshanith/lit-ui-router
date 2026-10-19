// A JavaScript consumer: the registry emits no runtime code, and lit-ui-router never imports it.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('the registry entries are empty modules', async () => {
  for (const specifier of ['ui-router-registry', 'ui-router-registry/lit']) {
    assert.deepEqual(Object.keys(await import(specifier)), [], specifier);
  }
});

test('uiSref builds a directive result with nothing registered', async () => {
  const { uiSref } = await import('lit-ui-router');

  const params = { contactId: 'c1' };

  assert.deepEqual(uiSref('contacts.contact', params).values, [
    'contacts.contact',
    params,
  ]);
});

test("lit-ui-router's JavaScript never names the registry", async () => {
  const dist = dirname(fileURLToPath(import.meta.resolve('lit-ui-router')));
  const files = await readdir(dist, { recursive: true });
  const scripts = files.filter((file) => file.endsWith('.js'));

  assert.ok(scripts.length > 0, `no .js under ${dist}`);

  for (const file of scripts) {
    const source = await readFile(join(dist, file), 'utf8');

    assert.ok(!source.includes('ui-router-registry'), file);
  }
});
