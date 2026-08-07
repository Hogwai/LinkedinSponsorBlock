import { describe, it, expect } from 'vitest';
import {
    SETTINGS_KEYS,
    DEFAULT_SETTINGS,
    EXTENSION_STORAGE_DEFAULTS,
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
        expect(SETTINGS_KEYS.HIDE_FLOATING_UI).toBe('hideFloatingUI');
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

    it('hide floating UI is disabled by default', () => {
        expect(DEFAULT_SETTINGS[SETTINGS_KEYS.HIDE_FLOATING_UI]).toBe(false);
    });
});

describe('EXTENSION_STORAGE_DEFAULTS', () => {
    const expectedKeys = [
        SETTINGS_KEYS.ENABLED,
        SETTINGS_KEYS.FILTER_PROMOTED,
        SETTINGS_KEYS.FILTER_SUGGESTED,
        SETTINGS_KEYS.FILTER_RECOMMENDED,
        SETTINGS_KEYS.LANGUAGE,
        SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED,
        SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED,
        SETTINGS_KEYS.TOTAL_POSTS_SCANNED,
        SETTINGS_KEYS.INSTALL_DATE,
        SETTINGS_KEYS.REVIEW_BANNER_DISMISSED,
        SETTINGS_KEYS.LOGGING,
    ];

    it('contains exactly the extension-owned keys', () => {
        expect(Object.keys(EXTENSION_STORAGE_DEFAULTS).sort()).toEqual([...expectedKeys].sort());
    });

    it('uses canonical DEFAULT_SETTINGS values for every key', () => {
        for (const key of expectedKeys) {
            expect(EXTENSION_STORAGE_DEFAULTS[key]).toBe(DEFAULT_SETTINGS[key]);
        }
    });

    it('does not include userscript-only or UI-only keys', () => {
        expect(EXTENSION_STORAGE_DEFAULTS).not.toHaveProperty(SETTINGS_KEYS.HIDE_FLOATING_UI);
        expect(EXTENSION_STORAGE_DEFAULTS).not.toHaveProperty(SETTINGS_KEYS.DISCREET);
        expect(EXTENSION_STORAGE_DEFAULTS).not.toHaveProperty(SETTINGS_KEYS.POSITION);
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
    it('returns detected language for supported locales', () => {
        Object.defineProperty(navigator, 'language', {
            value: 'fr-FR',
            configurable: true,
            writable: true,
        });
        expect(detectLanguage()).toBe('fr');
    });

    it('falls back to "en" for unsupported locale codes', () => {
        Object.defineProperty(navigator, 'language', {
            value: 'zz-ZZ',
            configurable: true,
            writable: true,
        });
        expect(detectLanguage()).toBe('en');
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
