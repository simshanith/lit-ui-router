import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { API_REFERENCES } from '../../catalog/navigation.ts';
import { PACKAGES, RUNTIMES } from '../../catalog/packages.ts';
import {
  entryPoints,
  packageIndex,
  packageManifests,
  peerLayer,
} from '../package-index.ts';
import { releasesPath } from '../release-stubs.ts';

const manifests = packageManifests();

const manifestOf = (name: string) => {
  const manifest = manifests.get(name);

  assert.ok(manifest, name);

  return manifest;
};

const layerOf = (entry: (typeof PACKAGES)[number]) =>
  'layer' in entry ? entry.layer : undefined;

describe('the package facets', () => {
  it('give a router package a layer and a lit package none', () => {
    for (const entry of PACKAGES) {
      assert.equal(
        layerOf(entry) !== undefined,
        entry.subject === 'router',
        entry.name,
      );
    }
  });

  it('agree with the layer each package.json peers decide', () => {
    const disagreements = PACKAGES.flatMap((entry) => {
      const derived = peerLayer(manifestOf(entry.name));

      return derived && derived !== layerOf(entry)
        ? [`${entry.name}: catalog ${layerOf(entry)}, peers ${derived}`]
        : [];
    });

    assert.deepEqual(disagreements, []);
  });

  it('derive layers from peers', () => {
    assert.equal(peerLayer(manifestOf('lit-ui-router-ssr')), 'lit');
    assert.equal(peerLayer(manifestOf('ui-router-registry')), 'agnostic');
    assert.equal(
      peerLayer(manifestOf('eslint-plugin-lit-ui-router')),
      undefined,
    );
  });

  it('list each runtime once, in vocabulary order', () => {
    for (const { name, runtime } of PACKAGES) {
      const ordered = RUNTIMES.filter((value) =>
        runtime.some((listed) => listed === value),
      );

      assert.deepEqual([...runtime], ordered, name);
    }
  });

  it('put a package with a ./vite entry in the build runtime', () => {
    for (const { name, runtime } of PACKAGES) {
      if ('./vite' in (manifestOf(name).exports ?? {}))
        assert.ok(
          runtime.some((value) => value === 'build'),
          name,
        );
    }
  });
});

describe('entryPoints', () => {
  it('names each exported subpath, leaving out wildcards and JSON', () => {
    const entries = entryPoints(manifestOf('lit-ui-router'));

    assert.ok(entries.includes('lit-ui-router'));
    assert.ok(entries.includes('lit-ui-router/context'));
    assert.ok(!entries.some((entry) => entry.includes('*')));
    assert.ok(!entries.some((entry) => entry.endsWith('.json')));
  });
});

describe('the package index', () => {
  const list = packageIndex(manifests);

  it('links each package page, API reference and releases page once', () => {
    for (const { name } of PACKAGES) {
      const reference = API_REFERENCES[name];
      const links = [
        `(/packages/${name})`,
        `(${releasesPath(name)})`,
        ...(reference ? [`(${reference})`] : []),
      ];

      for (const link of links) assert.equal(list.split(link).length, 2, link);
    }
  });

  it('lists every entry point', () => {
    for (const { name } of PACKAGES) {
      for (const entry of entryPoints(manifestOf(name)))
        assert.ok(list.includes(`\`${entry}\``), entry);
    }
  });
});
