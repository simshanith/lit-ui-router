import { afterEach, describe, expect, it, vi } from 'vitest';
import { html } from 'lit';

import { warnForeignClass } from '../dev-warn.js';

describe('warnForeignClass', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns once per class that names a second copy of lit', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Stands in for a LitElement from another lit copy: an element class, not ours.
    class ForeignElement extends HTMLElement {}

    warnForeignClass(ForeignElement);
    warnForeignClass(ForeignElement);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('second copy of lit'),
      ForeignElement,
    );
  });

  it('stays quiet for template functions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnForeignClass(() => html`arrow`);
    warnForeignClass(function template() {
      return html`function`;
    });

    expect(warn).not.toHaveBeenCalled();
  });
});
