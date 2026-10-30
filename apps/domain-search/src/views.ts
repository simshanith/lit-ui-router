import type { UIRouter } from '@uirouter/core';
import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { RoutedLitTemplate, UIRouterLit } from 'lit-ui-router/pure';
import 'lit-ui-router/ui-router.register';
import { uiViewSlot } from 'lit-ui-router-ssr/client';
import 'lit-ui-router-ssr/register';

import { INPUT_ID, QUERY_PARAM } from './pre-paint.ts';
import type { SearchResults } from './search.ts';

const SKELETON_ROWS = 6;

const price = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Goes to the child the input's value calls for; `reload` re-runs the results resolve on every keystroke. */
export const searchFor = (router: UIRouter, value: string): void => {
  const found = Boolean(value.trim());

  void router.stateService.go(
    found ? 'search.results' : 'search.idle',
    { [QUERY_PARAM]: value || null },
    { location: 'replace', reload: found ? 'search.results' : false },
  );
};

const activeChild = (router: UIRouter): string =>
  router.globals.current.name?.replace(/^search\./, '') ?? '';

const onInput =
  (router: UIRouter) =>
  (event: Event): void => {
    // SAFETY: the listener sits on the one search input.
    searchFor(router, (event.currentTarget as HTMLInputElement).value);
  };

const onSubmit = (event: Event): void => event.preventDefault();

/**
 * The parent view: it holds the input and never unmounts. `data-view` names
 * the active child, and CSS moves the input from the hero to the bar on it.
 */
export const SearchView: RoutedLitTemplate = ({ router }) => html`
  <div class="domain-search" data-view=${activeChild(router)}>
    <a class="brand" href="/domain-search"
      >lit-ui-router <span>domains</span></a
    >
    <h1 class="hero-title">Find your next domain</h1>
    <form class="search" role="search" @submit=${onSubmit}>
      <label class="visually-hidden" for=${INPUT_ID}>Search a domain</label>
      <input
        id=${INPUT_ID}
        type="search"
        name=${QUERY_PARAM}
        placeholder="Search a domain"
        autocomplete="off"
        spellcheck="false"
        value=${String(router.globals.params[QUERY_PARAM] ?? '')}
        @input=${onInput(router)}
      />
      <!--domain-search:pre-paint-->
    </form>
    <div class="skeleton" aria-hidden="true">
      ${Array.from({ length: SKELETON_ROWS }, () => html`<div class="row"></div>`)}
    </div>
    <ui-view>${uiViewSlot()}</ui-view>
  </div>
`;

export const IdleView: RoutedLitTemplate = () => html`
  <p class="hint">Type a name: results follow every keystroke.</p>
`;

export const ResultsView: RoutedLitTemplate<{ results: SearchResults }> = ({
  resolves: { results },
}) => html`
  <section class="results" aria-live="polite">
    <h2>Results for <q>${results.query.trim()}</q></h2>
    <ol>
      ${results.domains.map(
        (domain) => html`
          <li ?data-available=${domain.available}>
            <span class="name">${domain.name}</span>
            <span class="status"
              >${domain.available ? 'Available' : 'Taken'}</span
            >
            <span class="price"
              >${domain.available ? `${price.format(domain.price)}/yr` : ''}</span
            >
          </li>
        `,
      )}
    </ol>
  </section>
`;

/** The page both halves render: the server draws it, the client adopts it. */
export const page = (router: UIRouterLit): TemplateResult => html`
  <ui-router .uiRouter=${router}><ui-view>${uiViewSlot()}</ui-view></ui-router>
`;
