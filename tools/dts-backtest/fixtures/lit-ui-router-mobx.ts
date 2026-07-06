import { html, LitElement, type TemplateResult } from 'lit';
import { comparer } from 'mobx';
import { UIRouterLit } from 'lit-ui-router';
import {
  ReactionController,
  RouterReactionController,
  RouterStore,
  type ReactionControllerOptions,
  type RouterReactionControllerOptions,
} from 'lit-ui-router-mobx';

const structural: ReactionControllerOptions<string | undefined> = {
  equals: comparer.structural,
  onChange: (value) => void value,
};

export class NavElement extends LitElement {
  private store = RouterStore.for(new UIRouterLit());

  private stateName = new RouterReactionController(
    this,
    (store: RouterStore) => store.current?.name,
    structural satisfies RouterReactionControllerOptions<string | undefined>,
  );

  private params = new ReactionController(this, () => this.store.params, {
    equals: comparer.structural,
  });

  render(): TemplateResult {
    const transition = this.stateName.store?.transition;
    return html`${this.stateName.value} ${this.params.value.id} ${transition}`;
  }
}
