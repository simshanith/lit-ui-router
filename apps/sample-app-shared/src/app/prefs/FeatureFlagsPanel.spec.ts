import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { featureFlags } from '../util/featureDetection.js';
import { FeatureFlagsPanel } from './FeatureFlagsPanel.js';

const readStoredFlags = () =>
  JSON.parse(sessionStorage.getItem('featureFlags') ?? '{}') as Record<
    string,
    unknown
  >;

describe('feature flags panel', () => {
  let panel: FeatureFlagsPanel;
  let pluginSelect: HTMLSelectElement;

  const selectOption = (label: string) => {
    const option = [...pluginSelect.options].find(
      (opt) => opt.text.trim() === label,
    );
    if (!option) throw new Error(`no option labeled ${label}`);
    pluginSelect.value = option.value;
    pluginSelect.dispatchEvent(new Event('change'));
  };

  beforeEach(async () => {
    // reset the module singleton's in-memory flags, then the storage itself
    featureFlags.resetAll();
    sessionStorage.clear();

    panel = new FeatureFlagsPanel();
    document.body.append(panel);
    await panel.updateComplete;
    const select = panel.shadowRoot?.querySelector('select');
    if (!select) throw new Error('location-plugin select not rendered');
    pluginSelect = select;
  });

  afterEach(() => {
    panel.remove();
  });

  it('stores an explicit location plugin selection', () => {
    selectOption('Hash');
    expect(readStoredFlags()['location-plugin']).toBe('hash');
  });

  it('removes the stored preference when Auto-detect is selected', () => {
    selectOption('Hash');
    selectOption('Auto-detect');
    expect(readStoredFlags()).not.toHaveProperty('location-plugin');
  });
});
