import { describe, expect, it } from 'vitest';

import { parseOtlpHeaders } from './otlpExport.js';

describe('parseOtlpHeaders', () => {
  it('reads a comma-separated name=value list, trimmed and percent-decoded', () => {
    expect(parseOtlpHeaders(' x-team = k%2Cey , x-dataset=sample=app')).toEqual(
      {
        'x-team': 'k,ey',
        'x-dataset': 'sample=app',
      },
    );
  });

  it('skips entries with no name or no equals sign', () => {
    expect(parseOtlpHeaders('=value,,bare,x-ok=1')).toEqual({ 'x-ok': '1' });
  });

  it('skips an entry that is not percent-encoded', () => {
    expect(parseOtlpHeaders('x-bad=100%,x-ok=1')).toEqual({ 'x-ok': '1' });
  });

  it('reads nothing from an unset list', () => {
    expect(parseOtlpHeaders()).toEqual({});
    expect(parseOtlpHeaders('')).toEqual({});
  });
});
