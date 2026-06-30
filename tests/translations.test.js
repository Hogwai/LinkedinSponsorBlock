import { describe, it, expect } from 'vitest';
import { TRANSLATIONS, getTranslation, createTranslator } from '../src/shared/translations.js';

describe('TRANSLATIONS', () => {
    const requiredKeys = [
        'title', 'enabled', 'blockPromotedPosts', 'blockSuggestedPosts',
        'blockRecommendedPosts', 'settingsTitle', 'language',
    ];

    const variants = Object.keys(TRANSLATIONS);

    it('has at least 8 language variants', () => {
        expect(variants.length).toBeGreaterThanOrEqual(8);
    });

    it('every variant has all required keys', () => {
        for (const lang of variants) {
            for (const key of requiredKeys) {
                expect(TRANSLATIONS[lang]).toHaveProperty(key);
            }
        }
    });

    it('every value is a non-empty string', () => {
        for (const lang of variants) {
            for (const [key, value] of Object.entries(TRANSLATIONS[lang])) {
                expect(typeof value, `${lang}.${key} must be a string`).toBe('string');
                expect(value.length, `${lang}.${key} must not be empty`).toBeGreaterThan(0);
            }
        }
    });

    it('en variant has all keys that other variants have', () => {
        const enKeys = Object.keys(TRANSLATIONS.en);
        for (const lang of variants) {
            for (const key of Object.keys(TRANSLATIONS[lang])) {
                expect(enKeys, `${lang} has extra key "${key}" not in en`).toContain(key);
            }
        }
    });

    it('no variant has keys that en does not have', () => {
        const enKeys = new Set(Object.keys(TRANSLATIONS.en));
        for (const lang of variants) {
            const langKeys = Object.keys(TRANSLATIONS[lang]);
            const extraKeys = langKeys.filter((k) => !enKeys.has(k));
            expect(extraKeys, `${lang} has extra keys: ${extraKeys.join(', ')}`).toHaveLength(0);
        }
    });
});

describe('getTranslation', () => {
    it('returns the correct translation for a given language and key', () => {
        expect(getTranslation('fr', 'enabled')).toBe('Activé');
        expect(getTranslation('de', 'enabled')).toBe('Aktiviert');
        expect(getTranslation('en', 'enabled')).toBe('Enabled');
    });

    it('falls back to English when language is not found', () => {
        expect(getTranslation('invalid-code', 'enabled')).toBe('Enabled');
    });

    it('returns the key itself when translation is missing', () => {
        expect(getTranslation('en', '__nonexistent_key__')).toBe('__nonexistent_key__');
    });
});

describe('createTranslator', () => {
    it('returns a function that translates keys', () => {
        const t = createTranslator('fr');
        expect(t('enabled')).toBe('Activé');
        expect(t('title')).toBe('Linkedin Sponsor Block');
    });
});
