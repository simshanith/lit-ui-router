import { render } from '@lit-labs/ssr';
import { renderLight } from '@lit-labs/ssr-client/directives/render-light.js';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { describe, expect, it } from 'vitest';

import { LightDomHydrating } from '../light-dom.js';
import { isLightDomClass } from '../light-dom-brand.js';
import { LightElementRenderer } from '../light-element-renderer.js';
import { servedMarkerPrefix } from '../served-markers.js';

class SmokeCard extends LightDomHydrating(LitElement) {
  @property() label = '';

  override render(): TemplateResult {
    return html`<p>${this.label}</p>`;
  }
}

customElements.define('smoke-card', SmokeCard);

describe('LightElementRenderer (smoke)', () => {
  it('matches a class the mixin branded, and no other', () => {
    expect(isLightDomClass(SmokeCard)).toBe(true);
    expect(LightElementRenderer.matchesClass(SmokeCard)).toBe(true);
    expect(LightElementRenderer.matchesClass(LitElement)).toBe(false);
  });

  it('writes render() into the light DOM with no shadow root', () => {
    const markup = collectResultSync(
      render(html`<smoke-card .label=${'hi'}>${renderLight()}</smoke-card>`, {
        elementRenderers: [LightElementRenderer],
      }),
    );

    expect(markup).not.toContain('<template shadowroot');
    expect(markup).toContain('<p>');
    expect(markup).toContain('hi');
    expect(markup).toContain(`<!--${servedMarkerPrefix}lit-part`);
  });
});
