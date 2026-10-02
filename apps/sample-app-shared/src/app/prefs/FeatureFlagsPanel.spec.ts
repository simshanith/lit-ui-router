import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  featureFlags,
  setBootedLocationPlugin,
} from '../util/featureDetection.js';
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

  const statusText = () =>
    [
      ...(panel.shadowRoot?.querySelectorAll('.flag-resolved, .flag-pending') ??
        []),
    ]
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim())
      .join(' | ');

  // the panel reads the booted resolution once per mount, so remount to change it
  const mount = async () => {
    panel?.remove();
    panel = new FeatureFlagsPanel();
    document.body.append(panel);
    await panel.updateComplete;
    const select = panel.shadowRoot?.querySelector('select');
    if (!select) throw new Error('location-plugin select not rendered');
    pluginSelect = select;
  };

  beforeEach(async () => {
    // reset the module singleton's in-memory flags, then the storage itself
    featureFlags.resetAll();
    sessionStorage.clear();
    setBootedLocationPlugin(undefined);
    await mount();
  });

  afterEach(() => {
    panel.remove();
    setBootedLocationPlugin(undefined);
  });

  it('reports the plugin the preference resolves to before the router boots', () => {
    expect(statusText()).toMatch(
      /^Resolves to: (Navigation API|Push State) \(auto-detected\)$/,
    );
  });

  it('reports the plugin the router actually booted with', async () => {
    setBootedLocationPlugin({
      plugin: 'navigation',
      source: 'auto',
      downgraded: false,
    });
    await mount();
    expect(statusText()).toBe('In use: Navigation API (auto-detected)');
  });

  it('says a downgrade happened rather than echoing the preference', async () => {
    setBootedLocationPlugin({
      plugin: 'pushState',
      source: 'session',
      downgraded: true,
    });
    await mount();
    // only the in-use line: what a reload would do depends on this browser
    expect(statusText()).toContain(
      'In use: Push State (from this session, downgraded: no Navigation API)',
    );
  });

  it('separates what is in use from what a reload would switch to', async () => {
    setBootedLocationPlugin({
      plugin: 'navigation',
      source: 'auto',
      downgraded: false,
    });
    await mount();
    selectOption('Hash');
    await panel.updateComplete;
    expect(statusText()).toBe(
      'In use: Navigation API (auto-detected) | Reload to use Hash (from this session)',
    );
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
