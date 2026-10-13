import { html, LitElement, type TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router';
import { RouterSignals } from 'ui-router-signals';
import {
  RouterSignalController,
  SignalController,
  type RouterSignalControllerOptions,
  type SignalControllerOptions,
} from 'lit-ui-router-signals';

const router = new UIRouterLit();

const structural: SignalControllerOptions<string | undefined> = {
  equals: (a, b) => a === b,
  onChange: (value) => void value,
};

export class NavElement extends LitElement {
  private readonly stateName = new RouterSignalController(
    this,
    (signals: RouterSignals) => signals.current.get()?.name,
    { ...structural, router } satisfies RouterSignalControllerOptions<
      string | undefined
    >,
  );

  private readonly paramId = new SignalController(
    this,
    // SAFETY: the `id` param, when present, is a string-typed path param
    () => RouterSignals.for(router).params.get().id as string | undefined,
  );

  render(): TemplateResult {
    return html`${this.stateName.value} ${this.paramId.value}`;
  }
}
