import { html, LitElement, css, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  featureFlags,
  FeatureFlagDefinitions,
} from '../util/featureDetection.js';

interface FlagConfig {
  key: keyof FeatureFlagDefinitions;
  label: string;
  description: string;
  type: 'boolean' | 'select';
  options?: { value: string | undefined; label: string }[];
}

const FLAG_CONFIGS: FlagConfig[] = [
  {
    key: 'location-plugin',
    label: 'Location Plugin',
    description: 'Router location strategy (requires page reload)',
    type: 'select',
    options: [
      { value: undefined, label: 'None' },
      { value: 'hash', label: 'Hash' },
      { value: 'pushState', label: 'Push State' },
      { value: 'navigation', label: 'Navigation API' },
    ],
  },
  {
    key: 'enable-visualizer',
    label: 'Enable Visualizer',
    description: 'Show UI-Router state visualizer',
    type: 'boolean',
  },
  {
    key: 'enable-trace',
    label: 'Enable Trace',
    description: 'Enable transition/view tracing in console',
    type: 'boolean',
  },
  {
    key: 'enable-api-docs',
    label: 'Enable API Docs',
    description: 'Enable Custom Elements Manifest API Docs Viewer',
    type: 'boolean',
  },
];

@customElement('feature-flags-panel')
export class FeatureFlagsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 1rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-top: 1rem;
    }

    h3 {
      margin-top: 0;
      margin-bottom: 1rem;
    }

    .flag-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #eee;
    }

    .flag-row:last-child {
      border-bottom: none;
    }

    .flag-info {
      flex: 1;
    }

    .flag-label {
      font-weight: bold;
    }

    .flag-description {
      font-size: 0.85em;
      color: #666;
    }

    .flag-control {
      margin-left: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .url-override {
      font-size: 0.75em;
      color: #f0ad4e;
      margin-left: 0.5rem;
    }

    .actions {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      display: flex;
      gap: 0.5rem;
    }
  `;

  @state()
  private _flags: FeatureFlagDefinitions = featureFlags.getAll();

  private _handleBooleanChange(flag: keyof FeatureFlagDefinitions, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    featureFlags.set(flag, checked as FeatureFlagDefinitions[typeof flag]);
    this._flags = featureFlags.getAll();
  }

  private _handleSelectChange(flag: keyof FeatureFlagDefinitions, e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    featureFlags.set(flag, value as FeatureFlagDefinitions[typeof flag]);
    this._flags = featureFlags.getAll();
  }

  private _handleReset(flag: keyof FeatureFlagDefinitions) {
    featureFlags.reset(flag);
    this._flags = featureFlags.getAll();
  }

  private _handleResetAll() {
    featureFlags.resetAll();
    this._flags = featureFlags.getAll();
  }

  private _handleApply() {
    document.location.reload();
  }

  private _renderFlagControl(config: FlagConfig): TemplateResult {
    const value = this._flags[config.key];
    const isOverridden = featureFlags.isUrlOverridden(config.key);

    if (config.type === 'boolean') {
      return html`
        <input
          type="checkbox"
          ?checked=${value}
          ?disabled=${isOverridden}
          @change=${(e: Event) => this._handleBooleanChange(config.key, e)}
        />
      `;
    }

    if (config.type === 'select' && config.options) {
      return html`
        <select
          ?disabled=${isOverridden}
          @change=${(e: Event) => this._handleSelectChange(config.key, e)}
        >
          ${config.options.map(
            (opt) => html`
              <option value=${opt.value} ?selected=${value === opt.value}>
                ${opt.label}
              </option>
            `,
          )}
        </select>
      `;
    }

    return html``;
  }

  render() {
    return html`
      <h3>Feature Flags</h3>

      ${FLAG_CONFIGS.map(
        (config) => html`
          <div class="flag-row">
            <div class="flag-info">
              <div class="flag-label">
                ${config.label}
                ${featureFlags.isUrlOverridden(config.key)
                  ? html`<span class="url-override">(URL override)</span>`
                  : ''}
              </div>
              <div class="flag-description">${config.description}</div>
            </div>
            <div class="flag-control">
              ${this._renderFlagControl(config)}
              <button
                class="btn btn-sm"
                @click=${() => this._handleReset(config.key)}
                title="Reset to default"
              >
                <i class="fa fa-undo"></i>
              </button>
            </div>
          </div>
        `,
      )}

      <div class="actions">
        <button class="btn btn-secondary" @click=${this._handleResetAll}>
          Reset All
        </button>
        <button class="btn btn-primary" @click=${this._handleApply}>
          Apply & Reload
        </button>
      </div>
    `;
  }
}

export default FeatureFlagsPanel;
