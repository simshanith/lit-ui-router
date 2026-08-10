import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canUseNavigationAPI,
  featureFlags,
  isValidLocationPlugin,
  parseFeatureParams,
  resolveLocationPlugin,
  resolveLocationPluginFeature,
} from './featureDetection.js';

const ENV_KEY = 'VITE_SAMPLE_APP_LOCATION_PLUGIN';
const originalHref = window.location.href;
// the Navigation interface global is an independent signal from window.navigation
const shipsNavigationAPI = typeof Navigation !== 'undefined';

// the tester iframe URL carries params vitest needs, so add to it rather than replace it
const setFeatureParam = (key: string, value: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set(`feature-${key}`, value);
  history.replaceState(null, '', url);
};

const readStoredFlags = () =>
  JSON.parse(sessionStorage.getItem('featureFlags') ?? '{}') as Record<
    string,
    unknown
  >;

const clearFlags = () => {
  // reset the module singleton's in-memory flags, then the storage itself
  featureFlags.resetAll();
  sessionStorage.clear();
};

describe('feature detection', () => {
  beforeEach(clearFlags);

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    history.replaceState(null, '', originalHref);
    clearFlags();
  });

  describe('parseFeatureParams', () => {
    it('strips the feature- prefix', () => {
      expect(
        parseFeatureParams('?feature-location-plugin=navigation&feature-x=1'),
      ).toEqual({ 'location-plugin': 'navigation', x: '1' });
    });

    it('ignores params without the prefix', () => {
      expect(parseFeatureParams('?location-plugin=hash&debug=1')).toEqual({});
    });

    it('returns an empty object for an empty search', () => {
      expect(parseFeatureParams('')).toEqual({});
    });

    it('keeps the last value of a repeated key', () => {
      expect(parseFeatureParams('?feature-x=1&feature-x=2')).toEqual({
        x: '2',
      });
    });

    it('keeps an = inside a value', () => {
      expect(parseFeatureParams('?feature-token=a=b')).toEqual({
        token: 'a=b',
      });
    });
  });

  describe('isValidLocationPlugin', () => {
    it.each(['pushState', 'navigation', 'hash'])('accepts %s', (value) => {
      expect(isValidLocationPlugin(value)).toBe(true);
    });

    it('rejects undefined', () => {
      expect(isValidLocationPlugin(undefined)).toBe(false);
    });

    it('rejects an unknown symbol', () => {
      expect(isValidLocationPlugin('memory')).toBe(false);
    });
  });

  describe('canUseNavigationAPI', () => {
    it.runIf(shipsNavigationAPI)(
      'is true in a browser that ships the Navigation API',
      () => {
        expect(canUseNavigationAPI()).toBe(true);
      },
    );

    it.runIf(!shipsNavigationAPI)(
      'is false in a browser with no window.navigation',
      () => {
        expect(canUseNavigationAPI()).toBe(false);
      },
    );

    it('is false when window.navigation is undefined', () => {
      vi.stubGlobal('navigation', undefined);
      expect(canUseNavigationAPI()).toBe(false);
    });

    it('is false when navigation.navigate is not a function', () => {
      vi.stubGlobal('navigation', { navigate: 'nope' });
      expect(canUseNavigationAPI()).toBe(false);
    });
  });

  describe('resolveLocationPluginFeature', () => {
    it('prefers the stored flag over the env var', () => {
      vi.stubEnv(ENV_KEY, 'hash');
      featureFlags.set('location-plugin', 'navigation');
      expect(resolveLocationPluginFeature()).toBe('navigation');
    });

    it('falls back to the env var when no flag is stored', () => {
      vi.stubEnv(ENV_KEY, 'hash');
      expect(resolveLocationPluginFeature()).toBe('hash');
    });

    it('prefers a URL param over the stored flag', () => {
      featureFlags.set('location-plugin', 'navigation');
      setFeatureParam('location-plugin', 'hash');
      expect(resolveLocationPluginFeature()).toBe('hash');
    });

    it('returns an invalid env value unvalidated', () => {
      vi.stubEnv(ENV_KEY, 'memory');
      expect(resolveLocationPluginFeature()).toBe('memory');
    });
  });

  describe('resolveLocationPlugin', () => {
    it('keeps navigation when the Navigation API is available', () => {
      vi.stubGlobal('navigation', { navigate: () => undefined });
      featureFlags.set('location-plugin', 'navigation');
      expect(resolveLocationPlugin()).toBe('navigation');
    });

    it('downgrades navigation to pushState without the Navigation API', () => {
      vi.stubGlobal('navigation', undefined);
      featureFlags.set('location-plugin', 'navigation');
      expect(resolveLocationPlugin()).toBe('pushState');
    });

    it('downgrades a navigation env var too', () => {
      vi.stubGlobal('navigation', undefined);
      vi.stubEnv(ENV_KEY, 'navigation');
      expect(resolveLocationPlugin()).toBe('pushState');
    });

    it('keeps hash whatever the Navigation API support', () => {
      vi.stubGlobal('navigation', undefined);
      featureFlags.set('location-plugin', 'hash');
      expect(resolveLocationPlugin()).toBe('hash');
    });

    it('falls back to pushState for an unrecognized preference', () => {
      vi.stubEnv(ENV_KEY, 'memory');
      expect(resolveLocationPlugin()).toBe('pushState');
    });

    it('falls back to pushState when nothing is configured', () => {
      vi.stubEnv(ENV_KEY, undefined);
      expect(resolveLocationPlugin()).toBe('pushState');
    });
  });

  describe('FeatureFlags', () => {
    it('returns the default when nothing is stored', () => {
      expect(featureFlags.get('enable-visualizer')).toBe(true);
      expect(featureFlags.get('location-plugin')).toBeUndefined();
    });

    it('lets a URL param override the stored value', () => {
      featureFlags.set('enable-visualizer', true);
      setFeatureParam('enable-visualizer', 'false');
      expect(featureFlags.get('enable-visualizer')).toBe(false);
      expect(featureFlags.getAll()['enable-visualizer']).toBe(false);
      // the override does not rewrite storage
      expect(readStoredFlags()['enable-visualizer']).toBe(true);
    });

    it.each([
      ['true', true],
      ['1', true],
      ['false', false],
      ['0', false],
      ['yes', false],
    ])('coerces the boolean param %s to %s', (raw, parsed) => {
      setFeatureParam('enable-api-docs', raw);
      expect(featureFlags.get('enable-api-docs')).toBe(parsed);
    });

    it('leaves a non-boolean param as a string', () => {
      setFeatureParam('location-plugin', 'hash');
      expect(featureFlags.get('location-plugin')).toBe('hash');
    });

    it('reports which flags the URL overrides', () => {
      setFeatureParam('enable-trace', '1');
      expect(featureFlags.isUrlOverridden('enable-trace')).toBe(true);
      expect(featureFlags.isUrlOverridden('enable-visualizer')).toBe(false);
    });

    it('drops unknown URL params from getAll', () => {
      setFeatureParam('not-a-flag', '1');
      expect(featureFlags.getAll()).not.toHaveProperty('not-a-flag');
    });

    it('persists a set value', () => {
      featureFlags.set('location-plugin', 'hash');
      expect(readStoredFlags()).toEqual({ 'location-plugin': 'hash' });
    });

    it('toggles a boolean flag and persists it', () => {
      expect(featureFlags.toggle('enable-visualizer')).toBe(false);
      expect(featureFlags.get('enable-visualizer')).toBe(false);
      expect(readStoredFlags()['enable-visualizer']).toBe(false);
      expect(featureFlags.toggle('enable-visualizer')).toBe(true);
    });

    it('throws when toggling a non-boolean flag', () => {
      expect(() => featureFlags.toggle('location-plugin')).toThrow(
        'Cannot toggle non-boolean flag: location-plugin',
      );
    });

    it('resets one flag back to its default', () => {
      featureFlags.set('enable-visualizer', false);
      featureFlags.set('location-plugin', 'hash');
      featureFlags.reset('enable-visualizer');
      expect(featureFlags.get('enable-visualizer')).toBe(true);
      expect(featureFlags.get('location-plugin')).toBe('hash');
      expect(readStoredFlags()).toEqual({ 'location-plugin': 'hash' });
    });

    it('resets every flag', () => {
      featureFlags.set('enable-visualizer', false);
      featureFlags.set('location-plugin', 'hash');
      featureFlags.resetAll();
      expect(featureFlags.getAll()).toEqual({
        'location-plugin': undefined,
        'enable-visualizer': true,
        'enable-trace': import.meta.env.VITE_TRACE === 'true',
        'enable-api-docs': true,
      });
      expect(readStoredFlags()).toEqual({});
    });

    it('survives corrupt JSON in session storage', () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
      sessionStorage.setItem('featureFlags', '{not json');
      expect(() => featureFlags.load()).not.toThrow();
      expect(logged).toHaveBeenCalled();
      expect(featureFlags.get('enable-visualizer')).toBe(true);
      logged.mockRestore();
    });
  });
});
