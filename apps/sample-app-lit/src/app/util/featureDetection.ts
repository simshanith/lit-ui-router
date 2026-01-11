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
 * 2. Env var VITE_SAMPLE_APP_LOCATION_PLUGIN
 * 3. Fallback to 'hash'
 */
export function resolveLocationPlugin(): LocationPluginFeatureSymbol {
  const features = parseFeatureParams();
  const urlParam = features['location-plugin'];
  if (isValidLocationPlugin(urlParam)) return urlParam;

  const envVar = import.meta.env.VITE_SAMPLE_APP_LOCATION_PLUGIN as
    | string
    | undefined;
  if (isValidLocationPlugin(envVar)) return envVar;

  return 'hash';
}
