import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transformSync } from 'oxc-transform';

import { DEV_DEFINE_KEY, passDefine, VERSION_DEFINE_KEY } from './shared.ts';

const reader = `export const VERSION = ${VERSION_DEFINE_KEY};\n`;

// the define plugin rewrites this to `void 0`, so its survival proves the plugin stayed off
const unrelated = 'export const pick = (x?: number) => x ?? undefined;\n';

const emit = (source: string, dev?: string): string => {
  const define = passDefine(source, '1.2.3', dev);

  return transformSync('src/index.ts', source, { define }).code;
};

describe('passDefine', () => {
  it('replaces the version in a source that reads it', () => {
    const code = emit(reader);
    assert.match(code, /VERSION = "1\.2\.3"/);
    assert.doesNotMatch(code, /PACKAGE_VERSION/);
  });

  it('passes no define to a single-pass source that never reads it', () => {
    assert.equal(passDefine(unrelated, '1.2.3', undefined), undefined);
    assert.match(emit(unrelated), /\?\? undefined/);
  });

  it('defines only DEV for a dual-pass source that never reads the version', () => {
    assert.deepEqual(passDefine(unrelated, '1.2.3', 'false'), {
      [DEV_DEFINE_KEY]: 'false',
    });
  });

  it('defines both keys for a dual-pass source that reads the version', () => {
    assert.deepEqual(passDefine(reader, '1.2.3', 'true'), {
      [VERSION_DEFINE_KEY]: '"1.2.3"',
      [DEV_DEFINE_KEY]: 'true',
    });
  });

  it('defines nothing for the version when the manifest has none', () => {
    assert.equal(passDefine(reader, undefined, undefined), undefined);
  });
});
