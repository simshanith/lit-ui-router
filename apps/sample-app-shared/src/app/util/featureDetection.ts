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

/**
 * Detects if the Navigation API is available in the current browser.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
 */
export function canUseNavigationAPI(): boolean {
  return (
    typeof window !== 'undefined' &&
    'navigation' in window &&
    typeof (window as { navigation?: { navigate?: unknown } }).navigation
      ?.navigate === 'function'
  );
}

/** Explicit "no preference" value: identical to leaving the setting unset. */
export const LOCATION_PLUGIN_AUTO = 'default';

export function isValidLocationPlugin(
  value: string | undefined,
): value is LocationPluginFeatureSymbol {
  return value === 'pushState' || value === 'navigation' || value === 'hash';
}

/** Where a location-plugin preference came from, or `auto` when none applied. */
export type LocationPluginSource = 'url' | 'session' | 'env' | 'auto';

export interface ResolvedLocationPlugin {
  plugin: LocationPluginFeatureSymbol;
  source: LocationPluginSource;
  /** Set when a `navigation` preference fell back for lack of the API. */
  downgraded: boolean;
}

/**
 * Reads the configured preference, in priority order:
 * 1. URL param ?feature-location-plugin=...
 * 2. Session storage
 * 3. Env var VITE_SAMPLE_APP_LOCATION_PLUGIN
 *
 * `default` at any level means "no preference", so it stops the lookup rather
 * than falling through to the level below.
 */
function readLocationPluginPreference(): {
  value: string | undefined;
  source: Exclude<LocationPluginSource, 'auto'>;
} {
  const flag = featureFlags.get('location-plugin') as string | undefined;
  if (isValidLocationPlugin(flag) || flag === LOCATION_PLUGIN_AUTO) {
    const source = featureFlags.isUrlOverridden('location-plugin')
      ? 'url'
      : 'session';
    return { value: flag, source };
  }

  const env = import.meta.env.VITE_SAMPLE_APP_LOCATION_PLUGIN as
    | string
    | undefined;
  return { value: env, source: 'env' };
}

export function resolveLocationPluginFeature(): string | undefined {
  const { value } = readLocationPluginPreference();
  return value === LOCATION_PLUGIN_AUTO ? undefined : value;
}

/**
 * Resolves the location plugin actually handed to the router, and says why.
 *
 * A preference wins, except that `navigation` downgrades to `pushState` on a
 * browser without the API. With no preference — unset, `default`, or anything
 * unrecognized — the app chooses: Navigation API where it exists, `pushState`
 * everywhere else, and reports `auto`.
 */
export function describeLocationPlugin(): ResolvedLocationPlugin {
  const { value, source } = readLocationPluginPreference();
  const preferred =
    value === LOCATION_PLUGIN_AUTO || !isValidLocationPlugin(value)
      ? undefined
      : value;

  if (preferred === 'navigation' && !canUseNavigationAPI()) {
    return { plugin: 'pushState', source, downgraded: true };
  }
  if (preferred) return { plugin: preferred, source, downgraded: false };

  return {
    plugin: canUseNavigationAPI() ? 'navigation' : 'pushState',
    source: 'auto',
    downgraded: false,
  };
}

export function resolveLocationPlugin(): LocationPluginFeatureSymbol {
  return describeLocationPlugin().plugin;
}

let booted: ResolvedLocationPlugin | undefined;

/** Records what the router booted with, so prefs can report it verbatim. */
export function setBootedLocationPlugin(
  resolved: ResolvedLocationPlugin | undefined,
): void {
  booted = resolved;
}

/** What the running router booted with, or undefined before it is configured. */
export function bootedLocationPlugin(): ResolvedLocationPlugin | undefined {
  return booted;
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
        this._flags = JSON.parse(stored) as Partial<FeatureFlagDefinitions>;
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

  reset(flag: keyof FeatureFlagDefinitions): void {
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
