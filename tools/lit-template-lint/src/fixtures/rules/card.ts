import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface CardData {
  id: number;
}

/**
 * @slot - the body
 * @slot header - the title row
 */
@customElement('rule-card')
export class RuleCard extends LitElement {
  @property({ type: Number }) count = 0;
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) data: CardData = { id: 0 };
  // expect property-type
  @property({ type: String }) wrongType = 0;
  // expect property-type
  @property() untyped = 0;
  // expect property-type
  @property({ type: 'Number' }) named = 0;
  // expect invalid-attribute-name
  @property({ attribute: 'bad name' }) spaced = '';
  // expect property-visibility
  @property() private readonly hidden = '';

  peek() {
    return this.hidden;
  }
}

/**
 * @slot header - the only slot
 */
@customElement('rule-header')
export class RuleHeader extends LitElement {}

// expect invalid-tag-name
@customElement('nohyphen')
export class NoHyphen extends LitElement {}

declare global {
  interface HTMLElementTagNameMap {
    'rule-card': RuleCard;
    'rule-header': RuleHeader;
  }
}
