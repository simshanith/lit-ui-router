import { html, LitElement, type TemplateResult } from 'lit';
import { Effect, SubscriptionRef } from 'effect';
import { UIRouterLit } from 'lit-ui-router';
import {
  RefController,
  RouterRefController,
  routeRef,
  type RefControllerOptions,
  type RouteSnapshot,
  type RouterRefControllerOptions,
} from 'lit-ui-router-effect';

const structuralEquals = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const structural: RefControllerOptions<string | undefined> = {
  equals: structuralEquals,
  onChange: (value) => void value,
};

export class NavElement extends LitElement {
  private readonly route = routeRef(new UIRouterLit());

  private readonly count = Effect.runSync(SubscriptionRef.make(0));

  private readonly stateName = new RouterRefController(
    this,
    (route: RouteSnapshot) => route.current?.name,
    structural satisfies RouterRefControllerOptions<string | undefined>,
  );

  private readonly params = new RefController(
    this,
    [this.route, this.count] as const,
    (route, count) => ({ id: route.params.id as string | undefined, count }),
    { equals: structuralEquals },
  );

  render(): TemplateResult {
    const transition = this.params.value.count;
    return html`${this.stateName.value} ${this.params.value.id} ${transition}`;
  }
}
