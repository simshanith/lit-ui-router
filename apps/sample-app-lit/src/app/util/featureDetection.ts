/**
 * Parses URL params with `?feature-*` prefix into a clean object.
 * Example: `?feature-location-plugin=navigation` -> { 'location-plugin': 'navigation' }
 */
export function parseFeatureParams(
  search: string = window.location.search,
): Record<string, string> {
  const params = new URLSearchParams(search);
  const features: Record<string, string> = {};
  const prefix = 'feature-';

  for (const [key, value] of params.entries()) {
    if (key.startsWith(prefix)) {
      features[key.slice(prefix.length)] = value;
    }
  }
  return features;
}

export type LocationPluginFeatureSymbol = 'pushState' | 'navigation' | 'hash';

export function isValidLocationPlugin(
  value: string | undefined,
): value is LocationPluginFeatureSymbol {
  return value === 'pushState' || value === 'navigation' || value === 'hash';
}

/**
 * Resolves location plugin with priority:
 * 1. URL param ?feature-location-plugin=...
 * 2. Session storage
 * 3. Env var VITE_SAMPLE_APP_LOCATION_PLUGIN
 */
export function resolveLocationPluginFeature(): string | undefined {
  const feature = featureFlags.get('location-plugin');
  if (isValidLocationPlugin(feature)) return feature;

  // Check env var
  return import.meta.env.VITE_SAMPLE_APP_LOCATION_PLUGIN as string | undefined;
}

/**
 * Resolves location plugin from feature settings. Fallbacks to 'hash'
 */
export function resolveLocationPlugin(): LocationPluginFeatureSymbol {
  const feature = resolveLocationPluginFeature();
  if (isValidLocationPlugin(feature)) return feature;
  return 'hash';
}

export interface FeatureFlagDefinitions {
  'location-plugin': LocationPluginFeatureSymbol | undefined;
  'enable-visualizer': boolean;
  'enable-trace': boolean;
  'enable-api-docs': boolean;
}

const FLAG_DEFAULTS: FeatureFlagDefinitions = {
  'location-plugin': undefined,
  'enable-visualizer': true,
  'enable-trace': import.meta.env.VITE_TRACE === 'true',
  'enable-api-docs': true,
};

const STORAGE_KEY = 'featureFlags';

export class FeatureFlags {
  private _flags: Partial<FeatureFlagDefinitions>;

  constructor() {
    this._flags = {};
    this.load();
  }

  load(): void {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        this._flags = JSON.parse(stored);
      }
    } catch (error) {
      console.error(
        'Failed to load feature flags from session storage:',
        error,
      );
      this._flags = {};
    }
  }

  save(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._flags));
    } catch (error) {
      console.error('Failed to save feature flags to session storage:', error);
    }
  }

  get<K extends keyof FeatureFlagDefinitions>(
    flag: K,
  ): FeatureFlagDefinitions[K] {
    const urlParams = parseFeatureParams();
    if (flag in urlParams) {
      return this._parseValue(flag, urlParams[flag]);
    }

    if (flag in this._flags) {
      return this._flags[flag] as FeatureFlagDefinitions[K];
    }

    return FLAG_DEFAULTS[flag];
  }

  set<K extends keyof FeatureFlagDefinitions>(
    flag: K,
    value: FeatureFlagDefinitions[K],
  ): void {
    this._flags[flag] = value;
    this.save();
  }

  toggle<K extends keyof FeatureFlagDefinitions>(
    flag: K,
  ): FeatureFlagDefinitions[K] {
    const current = this.get(flag);
    if (typeof current !== 'boolean') {
      throw new Error(`Cannot toggle non-boolean flag: ${flag}`);
    }
    const newValue = !current as FeatureFlagDefinitions[K];
    this.set(flag, newValue);
    return newValue;
  }

  reset<K extends keyof FeatureFlagDefinitions>(flag: K): void {
    delete this._flags[flag];
    this.save();
  }

  resetAll(): void {
    this._flags = {};
    this.save();
  }

  getAll(): FeatureFlagDefinitions {
    const urlParams = parseFeatureParams();
    const result: Record<string, unknown> = { ...FLAG_DEFAULTS };

    for (const key of Object.keys(this._flags)) {
      if (key in FLAG_DEFAULTS) {
        result[key] = this._flags[key as keyof FeatureFlagDefinitions];
      }
    }

    for (const key of Object.keys(urlParams)) {
      if (key in FLAG_DEFAULTS) {
        const flagKey = key as keyof FeatureFlagDefinitions;
        result[key] = this._parseValue(flagKey, urlParams[key]);
      }
    }

    return result as unknown as FeatureFlagDefinitions;
  }

  isUrlOverridden(flag: keyof FeatureFlagDefinitions): boolean {
    const urlParams = parseFeatureParams();
    return flag in urlParams;
  }

  private _parseValue<K extends keyof FeatureFlagDefinitions>(
    flag: K,
    value: string,
  ): FeatureFlagDefinitions[K] {
    const defaultValue = FLAG_DEFAULTS[flag];

    if (typeof defaultValue === 'boolean') {
      return (value === 'true' || value === '1') as FeatureFlagDefinitions[K];
    }

    return value as FeatureFlagDefinitions[K];
  }
}

export const featureFlags = new FeatureFlags();
featureFlags.load();
