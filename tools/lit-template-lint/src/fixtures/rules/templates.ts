import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';

import './card.js';

export const templates = (s: string, n: number, b: boolean, fn: () => void) => [
  html`<rule-card count="3" ?open=${b} .data=${{ id: n }}></rule-card>`,
  html`<rule-card><b></b><i slot="header"></i></rule-card>`,
  html`<div dir="ltr" role="button listitem" tabindex="1" title=${s}></div>`,
  html`<input disabled type="checkbox" .value=${s} />`,
  html`<a href=${b ? '#x' : nothing} aria-hidden=${b}></a>`,
  html`<div class=${classMap({ a: b })} title=${ifDefined(s)}></div>`,
  html`<input value=${live(s)} />`,
  html`<ul>
    ${repeat(
      [n],
      (i) => i,
      (i) => html`<li>${i}</li>`,
    )}
  </ul>`,
  html`<p>${s}</p>
    <br /><svg><path d="M0 0" /></svg>`,
  html`<div class slot translate="" autocapitalize="words" id="a"></div>`,
  html`<canvas width="300" height=${n}></canvas>`,
  // expect unknown-slot
  html`<rule-card><b slot="footer"></b></rule-card>`,
  // expect unknown-slot
  html`<rule-header><b></b></rule-header>`,
  // expect unclosed-tag
  html`<rule-card />text`,
  // prettier-ignore
  // expect mixed-binding
  html`<div title=${s}'></div>`,
  // expect expressionless-binding
  html`<div .title="x"></div>`,
  // expect expressionless-binding
  html`<div @click="x"></div>`,
  // expect event-binding
  html`<div @click=${n}></div>`,
  // expect attribute-binding
  html`<div title=${{ a: 1 }}></div>`,
  // expect attribute-value
  html`<rule-card count="many"></rule-card>`,
  // expect attribute-value
  html`<rule-card open=${b}></rule-card>`,
  // expect attribute-value
  html`<input disabled="disabled" />`,
  // expect attribute-value
  html`<div dir=${s}></div>`,
  // expect attribute-value
  html`<div role="button nonsense"></div>`,
  // expect attribute-value
  html`<div title></div>`,
  // expect attribute-value
  html`<div id></div>`,
  // expect attribute-value
  html`<div translate="maybe"></div>`,
  // expect attribute-value
  html`<div autocapitalize="shout"></div>`,
  // expect attribute-value
  html`<canvas width="wide"></canvas>`,
  // expect attribute-value
  html`<div dir="${'ltr'}x"></div>`,
  // expect boolean-binding
  html`<div ?hidden="${b}x"></div>`,
  // expect directive-binding
  html`<div .title=${ifDefined(s)}></div>`,
  // expect directive-binding
  html`<div @click=${live(fn)}></div>`,
  // expect directive-binding
  html`<div title=${classMap({})}></div>`,
  // expect attribute-value
  html`<div tabindex=${live(s)}></div>`,
  // expect directive-binding
  html`<div title=${live(n)}></div>`,
  // the directive suppresses every check on the element it precedes
  html`<!-- @ts-expect-error -->
    <div dir="sideways" .title="x"></div>`,
  // expect suppression
  html`<!-- @ts-expect-error -->
    <div dir="ltr"></div>`,
  // the directive still covers checks after a binding that spans lines
  html`<!-- @ts-expect-error -->
    <div
      @click=${() => {
        fn();
      }}
      dir="sideways"
    ></div>`,
  // expect suppression
  html`${s}<!-- @ts-expect-error -->`,
  // expect attribute-value
  html`<div dir="sideways"></div>`,
  // prettier-ignore
  // expect attribute-value
  html`<svg><foreignObject><div dir="sideways"></div></foreignObject></svg>`,
];
