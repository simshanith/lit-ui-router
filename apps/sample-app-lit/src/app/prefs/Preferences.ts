import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import AppConfig from '../global/appConfig.js';

@customElement('sample-preferences')
export class Preferences extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state()
  restDelay = AppConfig.restDelay;

  handleResetData = () => {
    sessionStorage.clear();
    document.location.reload();
  };
  handleSavePrefs = () => {
    AppConfig.restDelay = this.restDelay;
    AppConfig.save();
    document.location.reload();
  };
  handleRestDelayChange = (e: Event) => {
    this.restDelay = Number((e.target as HTMLInputElement).value);
  };
  render() {
    return html`<div>
      <div>
        <button class="btn btn-primary" @click=${this.handleResetData}>
          <i class="fa fa-recycle"></i> <span>Reset All Data</span>
        </button>
      </div>
      <div>
        <label for="restDelay">Simulated REST API delay (ms)</label>
        <input
          type="text"
          name="restDelay"
          value=${this.restDelay}
          @change=${this.handleRestDelayChange}
        />
        <button class="btn btn-primary" @click=${this.handleSavePrefs}>
          Save
        </button>
      </div>
    </div>`;
  }
}

export default Preferences;
