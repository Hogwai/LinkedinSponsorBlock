import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadFixtureDOM, createTestState } from './helpers.js';

let createBlocker;

beforeEach(async () => {
    vi.resetModules();
    const blocker = await import('../src/shared/blocker.js');
    createBlocker = blocker.createBlocker;
});

describe('createBlocker', () => {
    it('throws if no state provided', () => {
        expect(() => createBlocker()).toThrow('requires a state object');
    });

    it('returns scanFeed and resetSessionCounters', () => {
        const state = createTestState();
        const blocker = createBlocker({ state });
        expect(blocker).toHaveProperty('scanFeed');
        expect(blocker).toHaveProperty('resetSessionCounters');
        expect(typeof blocker.scanFeed).toBe('function');
        expect(typeof blocker.resetSessionCounters).toBe('function');
    });
});

describe('scanFeed: disabled', () => {
    it('returns zeros when extension is disabled', () => {
        const state = createTestState({
            settings: { enabled: false },
        });
        const blocker = createBlocker({ state });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        const result = blocker.scanFeed(document.body);
        expect(result).toEqual({ promoted: 0, suggested: 0 });
    });
});

describe('scanFeed: feed-real-mixed', () => {
    let state;
    let blocker;
    let onBlocked;

    beforeEach(() => {
        state = createTestState();
        onBlocked = vi.fn();
        blocker = createBlocker({ state, onBlocked });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);
    });

    it('hides both sponsored posts (display: none)', () => {
        blocker.scanFeed(document.body);

        const sponsored1 = document.querySelector(
            '[data-lazy-mount-id="fixture-sponsored-1"]',
        );
        const sponsored2 = document.querySelector(
            '[data-lazy-mount-id="fixture-sponsored-2"]',
        );
        expect(sponsored1.style.display).toBe('none');
        expect(sponsored2.style.display).toBe('none');
    });

    it('hides both suggested posts (display: none)', () => {
        blocker.scanFeed(document.body);

        const suggested1 = document.querySelector(
            '[data-lazy-mount-id="fixture-suggested-follow-1"]',
        );
        const suggested2 = document.querySelector(
            '[data-lazy-mount-id="fixture-suggestions-1"]',
        );
        expect(suggested1.style.display).toBe('none');
        expect(suggested2.style.display).toBe('none');
    });

    it('hides the recommended post (display: none)', () => {
        blocker.scanFeed(document.body);

        const recommended = document.querySelector(
            '[data-lazy-mount-id="fixture-recommended-1"]',
        );
        expect(recommended.style.display).toBe('none');
    });

    it('does not hide organic posts', () => {
        blocker.scanFeed(document.body);

        const legit = document.querySelector(
            '[data-lazy-mount-id="fixture-legit-1"]',
        );
        const marie = document.getElementById('ember-100');
        const sophie = document.getElementById('ember-101');
        const pierre = document.getElementById('ember-102');

        expect(legit.style.display).not.toBe('none');
        expect(marie.style.display).not.toBe('none');
        expect(sophie.style.display).not.toBe('none');
        expect(pierre.style.display).not.toBe('none');
    });

    it('increments sessionPromotedRemoved correctly', () => {
        blocker.scanFeed(document.body);
        expect(state.sessionPromotedRemoved).toBe(2); // 2 sponsored
    });

    it('increments sessionSuggestedRemoved for suggested + recommended', () => {
        blocker.scanFeed(document.body);
        expect(state.sessionSuggestedRemoved).toBe(3); // 2 suggested + 1 recommended
    });

    it('calls onBlocked callback with correct counts', () => {
        blocker.scanFeed(document.body);
        expect(onBlocked).toHaveBeenCalledTimes(1);
        expect(onBlocked).toHaveBeenCalledWith({
            promoted: 2,
            suggested: 3,
            scanned: 9,
        });
    });

    it('returns correct scan result', () => {
        const result = blocker.scanFeed(document.body);
        expect(result).toEqual({
            promoted: 2,
            suggested: 3,
            scanned: 9,
            content: 4,
        });
    });
});

describe('scanFeed: filter toggles', () => {
    it('does not hide promoted when FILTER_PROMOTED is false', () => {
        const state = createTestState({
            settings: { filterPromoted: false },
        });
        const blocker = createBlocker({ state });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        blocker.scanFeed(document.body);

        const sponsored1 = document.querySelector(
            '[data-lazy-mount-id="fixture-sponsored-1"]',
        );
        const sponsored2 = document.querySelector(
            '[data-lazy-mount-id="fixture-sponsored-2"]',
        );
        expect(sponsored1.style.display).not.toBe('none');
        expect(sponsored2.style.display).not.toBe('none');
        expect(state.sessionPromotedRemoved).toBe(0);
    });

    it('does not hide suggested when FILTER_SUGGESTED is false', () => {
        const state = createTestState({
            settings: { filterSuggested: false },
        });
        const blocker = createBlocker({ state });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        blocker.scanFeed(document.body);

        // Only recommended is hidden (both suggested are skipped).
        // sessionSuggestedRemoved counts both categories.
        expect(state.sessionSuggestedRemoved).toBe(1);
    });

    it('does not hide recommended when FILTER_RECOMMENDED is false', () => {
        const state = createTestState({
            settings: { filterRecommended: false },
        });
        const blocker = createBlocker({ state });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        // Only promoted (2) and suggested (2) should be hidden (recommended is skipped)
        const result = blocker.scanFeed(document.body);
        expect(result).toEqual({
            promoted: 2,
            suggested: 2,
            scanned: 9,
            content: 4,
        });
    });
});

describe('resetSessionCounters', () => {
    it('resets all counters to zero', () => {
        const state = createTestState();
        const blocker = createBlocker({ state });

        const feed = loadFixtureDOM('feed-real-mixed.html');
        document.body.innerHTML = '';
        document.body.appendChild(feed);

        blocker.scanFeed(document.body);
        expect(state.sessionPromotedRemoved).toBeGreaterThan(0);
        expect(state.sessionSuggestedRemoved).toBeGreaterThan(0);

        blocker.resetSessionCounters();
        expect(state.sessionPromotedRemoved).toBe(0);
        expect(state.sessionSuggestedRemoved).toBe(0);
        expect(state.sessionPostsScanned).toBe(0);
    });
});
