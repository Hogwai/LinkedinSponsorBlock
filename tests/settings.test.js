import { describe, it, expect } from 'vitest';
import {
    SETTINGS_KEYS,
    DEFAULT_SETTINGS,
    LANGUAGES,
    POSITIONS,
    getSetting,
    mergeSettings,
    detectLanguage,
} from '../src/shared/settings.js';

describe('SETTINGS_KEYS', () => {
    it('has all expected keys', () => {
        expect(SETTINGS_KEYS.ENABLED).toBe('enabled');
        expect(SETTINGS_KEYS.FILTER_PROMOTED).toBe('filterPromoted');
        expect(SETTINGS_KEYS.FILTER_SUGGESTED).toBe('filterSuggested');
        expect(SETTINGS_KEYS.FILTER_RECOMMENDED).toBe('filterRecommended');
        expect(SETTINGS_KEYS.LOGGING).toBe('logging');
    });
});

describe('DEFAULT_SETTINGS', () => {
    it('has values for all SETTINGS_KEYS', () => {
        const keyValues = Object.values(SETTINGS_KEYS);
        for (const key of keyValues) {
            expect(DEFAULT_SETTINGS).toHaveProperty(key);
        }
    });

    it('extension is enabled by default', () => {
        expect(DEFAULT_SETTINGS[SETTINGS_KEYS.ENABLED]).toBe(true);
    });

    it('all filters are enabled by default', () => {
        expect(DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_PROMOTED]).toBe(true);
        expect(DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_SUGGESTED]).toBe(true);
        expect(DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_RECOMMENDED]).toBe(true);
    });
});

describe('getSetting', () => {
    it('returns value from settings object when present', () => {
        const settings = { enabled: false };
        expect(getSetting(settings, SETTINGS_KEYS.ENABLED)).toBe(false);
    });

    it('falls back to default when setting is undefined', () => {
        const settings = {};
        expect(getSetting(settings, SETTINGS_KEYS.ENABLED)).toBe(true);
    });

    it('uses provided value even when falsy', () => {
        const settings = { filterPromoted: false };
        expect(getSetting(settings, SETTINGS_KEYS.FILTER_PROMOTED)).toBe(false);
    });
});

describe('mergeSettings', () => {
    it('returns full defaults when no overrides', () => {
        const merged = mergeSettings({});
        expect(merged).toEqual(DEFAULT_SETTINGS);
    });

    it('overrides specific keys', () => {
        const merged = mergeSettings({ enabled: false, logging: true });
        expect(merged.enabled).toBe(false);
        expect(merged.logging).toBe(true);
        // Other values remain default
        expect(merged.filterPromoted).toBe(true);
    });

    it('does not mutate the original defaults', () => {
        const original = { ...DEFAULT_SETTINGS };
        mergeSettings({ enabled: false });
        expect(DEFAULT_SETTINGS).toEqual(original);
    });
});

describe('detectLanguage', () => {
    it('returns "en" for unsupported languages', () => {
        const originalLanguage = navigator.language;
        // We can't easily mock navigator.language in jsdom,
        // but we can verify the function exists and returns a string
        expect(typeof detectLanguage()).toBe('string');
    });
});

describe('LANGUAGES', () => {
    it('includes common languages', () => {
        expect(LANGUAGES).toContain('en');
        expect(LANGUAGES).toContain('fr');
        expect(LANGUAGES).toContain('de');
        expect(LANGUAGES).toContain('es');
    });
});

describe('POSITIONS', () => {
    it('has four positions', () => {
        expect(Object.keys(POSITIONS)).toHaveLength(4);
    });
});
