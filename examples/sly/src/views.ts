import { css, html } from 'lit';
import { signal } from '@e280/strata';
import { shadowView, useCss, useName } from '@e280/sly';
import { uiSref, uiSrefActive } from 'lit-ui-router';

import { SWATCHES, type Swatch } from './swatches';

// App state lives in a strata signal; any view that reads it re-renders when it changes.
export const $starred = signal<readonly string[]>([]);

const toggleStar = (id: string) =>
  $starred(
    $starred().includes(id)
      ? $starred().filter((starred) => starred !== id)
      : [...$starred(), id],
  );

const listCss = css`
  :host {
    display: grid;
    grid-template-columns: minmax(10rem, 14rem) 1fr;
    gap: 24px;
  }
  ul {
    display: grid;
    align-content: start;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  a {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    color: inherit;
    text-decoration: none;
  }
  a:hover {
    background: light-dark(#0000000d, #ffffff14);
  }
  a.selected {
    outline: 2px solid currentcolor;
  }
  .chip {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: var(--swatch);
  }
  @media (max-width: 480px) {
    :host {
      grid-template-columns: 1fr;
    }
  }
`;

// A sly shadow view: a hooks function rendered into its own <sly-shadow> host and shadow root.
export const SwatchList = shadowView(() => {
  useName('swatch-list');
  useCss(listCss);

  return html`
    <ul>
      ${SWATCHES.map(
        (swatch) => html`
          <li>
            <a
              style="--swatch: ${swatch.hex}"
              ${uiSrefActive({ activeClasses: ['selected'] })}
              ${uiSref('.swatch', { id: swatch.id })}
            >
              <span class="chip"></span>${swatch.name}
              ${$starred().includes(swatch.id) ? '★' : ''}
            </a>
          </li>
        `,
      )}
    </ul>
    <ui-view><p>Pick a pigment.</p></ui-view>
  `;
});

const detailCss = css`
  article {
    display: grid;
    gap: 8px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid light-dark(#0000001f, #ffffff29);
  }
  .plate {
    height: 8rem;
    border-radius: 8px;
    background: var(--swatch);
  }
  button {
    justify-self: start;
    font: inherit;
  }
`;

export const SwatchDetail = shadowView((swatch: Swatch) => {
  useName('swatch-detail');
  useCss(detailCss);

  const starred = $starred().includes(swatch.id);

  return html`
    <article style="--swatch: ${swatch.hex}">
      <div class="plate"></div>
      <h3>${swatch.name}</h3>
      <p>${swatch.note}</p>
      <button aria-pressed=${starred} @click=${() => toggleStar(swatch.id)}>
        ${starred ? '★ Starred' : '☆ Star'}
      </button>
    </article>
  `;
});
