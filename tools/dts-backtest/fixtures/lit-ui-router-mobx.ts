import { html, LitElement, type TemplateResult } from 'lit';
// The concrete structural comparer is spelled per-major (`comparer.structural`
// on mobx 6, `compareStructural` on 7), so this consumer fixture — which must
// hold for the whole `^6.0.0 || ^7.0.0` peer range — asserts against the
// `IEqualsComparer` type both majors export instead of either spelling.
import type { IEqualsComparer } from 'mobx';
import { UIRouterLit } from 'lit-ui-router';
import {
  ReactionController,
  RouterReactionController,
  RouterStore,
  type ReactionControllerOptions,
  type RouterReactionControllerOptions,
} from 'lit-ui-router-mobx';

const structuralEquals: IEqualsComparer<unknown> = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b);

const structural: ReactionControllerOptions<string | undefined> = {
  equals: structuralEquals,
  onChange: (value) => void value,
};

export class NavElement extends LitElement {
  private readonly store = RouterStore.for(new UIRouterLit());

  private readonly stateName = new RouterReactionController(
    this,
    (store: RouterStore) => store.current?.name,
    structural satisfies RouterReactionControllerOptions<string | undefined>,
  );

  private readonly params = new ReactionController(
    this,
    () => this.store.params,
    {
      equals: structuralEquals,
    },
  );

  render(): TemplateResult {
    const transition = this.stateName.store?.transition;
    return html`${this.stateName.value} ${this.params.value.id} ${transition}`;
  }
}
