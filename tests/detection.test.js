import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFixtureDOM } from './helpers.js';

let detection;
let config;

beforeEach(async () => {
    vi.resetModules();
    // Re-import to get a fresh scannedPosts WeakSet
    detection = await import('../src/shared/detection.js');
    config = await import('../src/shared/config.js');
    // Ensure modern profile is active
    config.applyLayout('modern');
});

describe('getUnscannedPosts: feed-real-mixed', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('returns 2 sponsored posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(2);
    });

    it('returns 2 suggested posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(2);
    });

    it('returns 1 recommended post', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.recommended).toHaveLength(1);
    });

    it('returns 4 content (organic) posts', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(4);
    });

    it('total posts = 9', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(9);
    });

    it('sponsored post via text keyword "Post sponsorisé" is detected', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.sponsored.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Post sponsorisé'))).toBe(true);
    });

    it('suggested posts contain both "Suivi par" and "Suggestions"', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.suggested.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Suivi par'))).toBe(true);
        expect(textContents.some((t) => t.includes('Suggestions'))).toBe(true);
    });

    it('recommended post is detected (p[componentkey]="Recommandé pour vous")', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const textContents = groups.recommended.map((p) => p.textContent);
        expect(textContents.some((t) => t.includes('Recommandé pour vous'))).toBe(true);
    });

    it('organic posts are not in sponsored/suggested/recommended groups', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const organicTexts = groups.content.map((p) => p.textContent);

        expect(organicTexts.some((t) => t.includes('Content de partager'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('Nouveau projet'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('Premier jour'))).toBe(true);
        expect(organicTexts.some((t) => t.includes('meilleurs ETFs'))).toBe(true);
    });
});

describe('getUnscannedPosts: feed-real-ads', () => {
    it('returns all posts as sponsored', () => {
        const feed = loadFixtureDOM('feed-real-ads.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        // One via p[componentkey] "Post sponsorisé", one via child selector
        expect(groups.sponsored).toHaveLength(2);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(0);
    });
});

describe('getUnscannedPosts: feed-real-organic', () => {
    it('returns all posts as content', () => {
        const feed = loadFixtureDOM('feed-real-organic.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(0);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(4);
    });
});

describe('getUnscannedPosts: feed-empty', () => {
    it('returns empty groups', () => {
        const feed = loadFixtureDOM('feed-empty.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(0);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.recommended).toHaveLength(0);
        expect(groups.content).toHaveLength(0);
    });
});



describe('legacy profile detection', () => {
    it('works with legacy selectors', async () => {
        config.applyLayout('legacy');

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const groups = detection.getUnscannedPosts(document.body);
        // Legacy uses different selectors: may not match the same posts
        // Just verify it runs without error and returns expected structure
        expect(groups).toHaveProperty('sponsored');
        expect(groups).toHaveProperty('suggested');
        expect(groups).toHaveProperty('recommended');
        expect(groups).toHaveProperty('content');
    });
});
