import { describe, it, expect } from 'vitest';
import { CONFIG, getActiveProfile, applyLayout } from '../src/shared/config.js';

describe('CONFIG structure', () => {
    it('has two profiles: modern and legacy', () => {
        expect(CONFIG.profiles).toHaveProperty('modern');
        expect(CONFIG.profiles).toHaveProperty('legacy');
    });

    it('default activeProfile is "modern"', () => {
        expect(CONFIG.activeProfile).toBe('modern');
    });

    it('modern profile has feedWrapper with three selectors', () => {
        const { feedWrapper } = CONFIG.profiles.modern;
        expect(feedWrapper).toHaveProperty('newFeed');
        expect(feedWrapper).toHaveProperty('desktop');
        expect(feedWrapper).toHaveProperty('mobile');
    });

    it('modern profile has postContainers (non-empty array)', () => {
        const { postContainers } = CONFIG.profiles.modern;
        expect(Array.isArray(postContainers)).toBe(true);
        expect(postContainers.length).toBeGreaterThan(0);
    });

    it('modern profile has detection with sponsored, suggested, recommended', () => {
        const { detection } = CONFIG.profiles.modern;
        expect(detection).toHaveProperty('sponsored');
        expect(detection).toHaveProperty('suggested');
        expect(detection).toHaveProperty('recommended');
    });
});

describe('getActiveProfile', () => {
    it('returns the modern profile by default', () => {
        const profile = getActiveProfile();
        expect(profile).toBe(CONFIG.profiles.modern);
    });
});

describe('applyLayout', () => {
    it('switches to the specified profile', () => {
        const result = applyLayout('legacy');
        expect(result).toBe(true);
        expect(CONFIG.activeProfile).toBe('legacy');
        expect(getActiveProfile()).toBe(CONFIG.profiles.legacy);

        // Reset back
        applyLayout('modern');
    });

    it('returns false for unknown profile and warns', () => {
        const result = applyLayout('nonexistent');
        expect(result).toBe(false);
    });

    it('detection profiles have keywordSelectors', () => {
        const profile = getActiveProfile();
        const { detection } = profile;

        for (const [key, det] of Object.entries(detection)) {
            expect(det).toHaveProperty('keywordSelectors');
            expect(Array.isArray(det.keywordSelectors)).toBe(true);
            expect(det.keywordSelectors.length).toBeGreaterThan(0);
            expect(det).toHaveProperty('keywords');
            expect(det.keywords instanceof Set).toBe(true);
            expect(det.keywords.size).toBeGreaterThan(0);
        }
    });
});

describe('SHARED_KEYWORDS: detection keywords', () => {
    it('includes common sponsored keywords in multiple languages', () => {
        const { sponsored } = CONFIG.profiles.modern.detection;
        expect(sponsored.keywords.has('promoted')).toBe(true);
        expect(sponsored.keywords.has('promoted by')).toBe(true);
        expect(sponsored.keywords.has('anzeige')).toBe(true);
        expect(sponsored.keywords.has('gesponsert')).toBe(true);
        expect(sponsored.keywords.has('promocionado')).toBe(true);
        expect(sponsored.keywords.has('publicité')).toBe(false); // not present
    });

    it('suggested keywords include common variants', () => {
        const { suggested } = CONFIG.profiles.modern.detection;
        expect(suggested.keywords.has('suggestions')).toBe(true);
        expect(suggested.keywords.has('suggested')).toBe(true);
        expect(suggested.keywords.has('vorgeschlagen')).toBe(true);
    });

    it('recommended keywords include common variants', () => {
        const { recommended } = CONFIG.profiles.modern.detection;
        expect(recommended.keywords.has('recommended for you')).toBe(true);
        expect(recommended.keywords.has('recommandé pour vous')).toBe(true);
        expect(recommended.keywords.has('für sie empfohlen')).toBe(true);
    });

    it('sponsored detection has childSelectors', () => {
        const { sponsored } = CONFIG.profiles.modern.detection;
        expect(Array.isArray(sponsored.childSelectors)).toBe(true);
        expect(sponsored.childSelectors).toContain('article[data-sponsored-tracking-url]');
    });

    it('suggested detection has childSelectors', () => {
        const { suggested } = CONFIG.profiles.modern.detection;
        expect(Array.isArray(suggested.childSelectors)).toBe(true);
        expect(suggested.childSelectors.length).toBeGreaterThan(0);
    });
});
