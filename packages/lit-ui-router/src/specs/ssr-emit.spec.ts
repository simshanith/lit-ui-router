import { describe, it, expect } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

import '../register.js';
import { srefActiveClass, srefAriaCurrent } from '../sref-active.js';

const emit = (template: TemplateResult) => collectResultSync(render(template));

const shadowRoot = '<template shadowroot="open" shadowrootmode="open">';

describe('@lit-labs/ssr emit', () => {
  it('leaves the sref status attributes as authored without a router', () => {
    const out = emit(
      html`<a
        class="nav ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}"
        aria-current=${srefAriaCurrent({ state: 'users' })}
        >Users</a
      >`,
    );

    expect(out).toContain('class="nav "');
    expect(out).not.toContain('aria-current');
  });

  it('should render <ui-router> as a slotted declarative shadow root', () => {
    const out = emit(html`<ui-router><p>light</p></ui-router>`);

    expect(out).toContain(`<ui-router>${shadowRoot}`);
    expect(out).toContain('<slot></slot>');
    expect(out).toContain('</template><p>light</p></ui-router>');
  });

  it('should render <ui-view> with its fallback kept in the light DOM (#803)', () => {
    const out = emit(html`<ui-view><p>fallback</p></ui-view>`);

    expect(out).toContain(`<ui-view>${shadowRoot}`);
    expect(out).toMatch(
      /<ui-view><template[^>]*><!--lit-part [^>]*--><slot><\/slot>/,
    );
    expect(out).toContain('</template><p>fallback</p></ui-view>');
  });

  it('should render a shell of nested views without an empty shadow root', () => {
    const out = emit(
      html`<ui-router
        ><ui-view name="rail"><ui-view></ui-view></ui-view
      ></ui-router>`,
    );

    const views = out.match(/<ui-view[^>]*><template[^>]*>(.*?)<\/template>/g);
    expect(views).toHaveLength(2);
    for (const view of views!) {
      expect(view).toContain('<slot></slot>');
    }
  });
});
