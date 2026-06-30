import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFixtureDOM } from './helpers.js';

let detection;
let config;

beforeEach(async () => {
    vi.resetModules();
    detection = await import('../src/shared/detection.js');
    config = await import('../src/shared/config.js');
    config.applyLayout('modern');
});

describe('getUnscannedPosts: feed-real-sponsored', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-sponsored.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('detects the real sponsored post via p[componentkey] + "Post sponsorisé"', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
    });

    it('classifies the organic post as content', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(1);
    });

    it('total posts = 2 (1 sponsored + 1 organic)', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(2);
    });

    it('sponsored post contains expected keyword text', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const sponsoredPost = groups.sponsored[0];
        expect(sponsoredPost.textContent.toLowerCase()).toContain('post sponsorisé');
    });

    it('sponsored post is found via data-lazy-mount-id container', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const sponsoredPost = groups.sponsored[0];
        // The outer wrapper has data-lazy-mount-id
        const hasLazyMount = sponsoredPost.matches?.('[data-lazy-mount-id]') ||
            sponsoredPost.querySelector('[data-lazy-mount-id]');
        expect(hasLazyMount).toBeTruthy();
    });

    it('p[componentkey] selector matches the sponsored indicator element', () => {
        const indicator = feed.querySelector('p[componentkey]');
        expect(indicator).not.toBeNull();
        expect(indicator.textContent.trim().toLowerCase()).toBe('post sponsorisé');
    });

    it('nested post containers (data-display-contents) are not double-counted', () => {
        // The real DOM has div[data-display-contents] nested inside div[data-lazy-mount-id]
        // Both match postContainers selectors. The filter should keep only the outermost.
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(2);

        // Each post should be counted exactly once: no duplicates
        const posts = [...groups.sponsored, ...groups.suggested, ...groups.recommended, ...groups.content];
        const uniquePosts = new Set(posts);
        expect(uniquePosts.size).toBe(total);
    });

    it('blocks correctly with the blocker', async () => {
        const { createBlocker } = await import('../src/shared/blocker.js');
        const state = {
            observer: null,
            isObserverConnected: false,
            sessionPromotedRemoved: 0,
            sessionSuggestedRemoved: 0,
            sessionPostsScanned: 0,
            settings: {
                enabled: true,
                filterPromoted: true,
                filterSuggested: true,
                filterRecommended: true,
            },
        };
        const blocker = createBlocker({ state });
        const result = blocker.scanFeed(document.body);

        expect(result.promoted).toBe(1);
        expect(result.content).toBe(1);
        expect(result.scanned).toBe(2);

        // Verify the sponsored post was hidden
        const sponsoredEl = feed.querySelector('[data-lazy-mount-id]');
        expect(sponsoredEl.style.display).toBe('none');

        // Verify organic post was NOT hidden
        const organicEl = feed.querySelector('#ember-100');
        expect(organicEl.style.display).not.toBe('none');
    });
});

describe('getUnscannedPosts: feed-real-suggested', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-suggested.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('detects the suggested post via "Suivi par" textNode', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(1);
    });

    it('classifies the organic post as content', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(1);
    });

    it('total posts = 2 (1 suggested + 1 organic)', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(2);
    });

    it('direct text node extraction matches "suivi par" from mixed content span', () => {
        // The span contains "Suivi par" + names. The direct text node is "Suivi par"
        const groups = detection.getUnscannedPosts(document.body);
        const suggestedPost = groups.suggested[0];
        expect(suggestedPost.textContent.toLowerCase()).toContain('suivi par');
    });

    it('nested containers are not double-counted', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const posts = [...groups.sponsored, ...groups.suggested, ...groups.recommended, ...groups.content];
        const uniquePosts = new Set(posts);
        expect(uniquePosts.size).toBe(2);
    });
});

describe('getUnscannedPosts: feed-real-suggestions', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-suggestions.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('detects the suggested post via "Suggestions" keyword', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(1);
    });

    it('classifies the organic post as content', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(1);
    });

    it('total posts = 2 (1 suggested + 1 organic)', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(2);
    });

    it('"Suggestions" text is standalone (no mixed content)', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const suggestedPost = groups.suggested[0];
        // The "Suggestions" text should be present in the post
        const hasSuggestions = Array.from(suggestedPost.querySelectorAll('*'))
            .some(el => el.textContent.trim() === 'Suggestions');
        expect(hasSuggestions).toBe(true);
    });

    it('translation button does not interfere with detection', () => {
        // The button "Afficher la traduction" is NOT a detection trigger
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(1);
        expect(groups.sponsored).toHaveLength(0);
    });
});

describe('getUnscannedPosts: feed-real-legit', () => {
    let feed;

    beforeEach(() => {
        feed = loadFixtureDOM('feed-real-legit.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('does NOT falsely flag the legit post as suggested/sponsored/recommended', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.suggested).toHaveLength(0);
        expect(groups.sponsored).toHaveLength(1); // there's a sponsored post too
        expect(groups.recommended).toHaveLength(0);
    });

    it('classifies the legit post as content', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.content).toHaveLength(1);
    });

    it('total posts = 2 (1 legit + 1 sponsored)', () => {
        const groups = detection.getUnscannedPosts(document.body);
        const total =
            groups.sponsored.length +
            groups.suggested.length +
            groups.recommended.length +
            groups.content.length;
        expect(total).toBe(2);
    });

    it('"aime ce contenu" social proof does not match any keyword', () => {
        // The social proof bar has p[componentkey] with text "X aime ce contenu"
        // This should not trigger any detection
        const groups = detection.getUnscannedPosts(document.body);
        const legitPost = groups.content[0];
        const hasSocialProof = Array.from(legitPost.querySelectorAll('[componentkey*="social"]'))
            .some(el => el.textContent.toLowerCase().includes('aime ce contenu'));
        expect(hasSocialProof).toBe(true);
    });

    it('sponsored post in the same feed is still detected', () => {
        const groups = detection.getUnscannedPosts(document.body);
        expect(groups.sponsored).toHaveLength(1);
        const sponsoredPost = groups.sponsored[0];
        expect(sponsoredPost.textContent.toLowerCase()).toContain('sponsorisé');
    });
});
