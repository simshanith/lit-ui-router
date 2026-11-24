// The home page shows this module below its imports; ../home-sample.ts marks the regions it explains.
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { Transition } from '@uirouter/core';
import { uiSref, type LitStateDeclaration } from 'lit-ui-router';
import { cardFor, cardView, type Card } from './cards.ts';

export const cardState: LitStateDeclaration<{ card: Card }> = {
  name: 'card',
  url: '/:cardId',
  component: ({ resolves }) => cardView(resolves.card),
  resolve: [
    {
      token: 'card',
      deps: ['$transition$'],
      resolveFn: (transition: Transition) =>
        cardFor(transition.params().cardId),
    },
  ],
};

@customElement('app-root')
export class AppRoot extends LitElement {
  render() {
    return html`
      <ui-view></ui-view>
      <a ${uiSref('card', { cardId: 'views' })}>Views</a>
    `;
  }
}
