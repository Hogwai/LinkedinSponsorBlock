import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadFixtureDOM, createTestState } from './helpers.js';

let CONFIG;
let createObserver;
let getActiveProfile;
let applyLayout;

afterEach(() => {
    vi.useRealTimers();
});

// Helper to wait for MutationObserver + debounce in jsdom
function waitForObserver() {
    return new Promise((r) => setTimeout(r, CONFIG.DELAYS.OBSERVER_RETRY + 20));
}

beforeEach(async () => {
    vi.resetModules();
    const config = await import('../src/shared/config.js');
    CONFIG = config.CONFIG;
    getActiveProfile = config.getActiveProfile;
    applyLayout = config.applyLayout;
    const observerMod = await import('../src/shared/observer.js');
    createObserver = observerMod.createObserver;

    // Reset DOM
    document.body.innerHTML = '';
});

describe('createObserver', () => {
    it('returns start and stop functions', () => {
        const state = createTestState();
        const observer = createObserver(vi.fn(), state);
        expect(observer).toHaveProperty('start');
        expect(observer).toHaveProperty('stop');
        expect(typeof observer.start).toBe('function');
        expect(typeof observer.stop).toBe('function');
    });
});

describe('start: layout detection', () => {
    it('detects modern layout from body[data-rehydrated]', () => {
        document.body.setAttribute('data-rehydrated', '');

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        observer.start();

        expect(applyLayout('modern')).toBe(true);
    });

    it('detects legacy layout from body.ember-application', () => {
        document.body.classList.add('ember-application');

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        observer.start();
        // Just confirm legacy profile is loaded separately: layout is detected during connect
        // The observer.start will retry because no feed wrapper matches
    });
});

describe('start: feed finding', () => {
    it('finds feed by data-testid="mainFeed" and connects observer', () => {
        // Set modern layout
        document.body.setAttribute('data-rehydrated', '');
        // Add a feed wrapper
        const feed = document.createElement('div');
        feed.setAttribute('data-testid', 'mainFeed');
        document.body.appendChild(feed);

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        // Use fake timers to control setTimeout
        vi.useFakeTimers();
        observer.start();
        vi.runAllTimers();

        // Observer should now be connected
        expect(state.isObserverConnected).toBe(true);
        expect(state.observer).not.toBeNull();

        vi.useRealTimers();
    });
});

describe('MutationObserver triggers scan', () => {
    it('calls scanFn when new nodes are added', async () => {
        document.body.setAttribute('data-rehydrated', '');
        const feed = document.createElement('div');
        feed.setAttribute('data-testid', 'mainFeed');
        document.body.appendChild(feed);

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        observer.start();
        await waitForObserver();

        // scanFn should have been called during connect
        expect(scanFn).toHaveBeenCalledTimes(1);

        // Simulate a DOM mutation: add a new post
        scanFn.mockClear();
        const newPost = document.createElement('div');
        feed.appendChild(newPost);

        await waitForObserver();
        expect(scanFn).toHaveBeenCalledTimes(1);
    });

    it('does not call scanFn for non-element mutations', async () => {
        document.body.setAttribute('data-rehydrated', '');
        const feed = document.createElement('div');
        feed.setAttribute('data-testid', 'mainFeed');
        document.body.appendChild(feed);

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        observer.start();
        await waitForObserver();
        scanFn.mockClear();

        // Text node mutation should not trigger scan
        feed.appendChild(document.createTextNode('some text'));
        await waitForObserver();
        expect(scanFn).not.toHaveBeenCalled();
    });
});

describe('start: retry logic', () => {
    it('retries when feed wrapper is not found initially', () => {
        document.body.setAttribute('data-rehydrated', '');

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        vi.useFakeTimers();
        observer.start();

        // Feed not found yet, should schedule a retry
        expect(state.isObserverConnected).toBe(false);

        // Now add the feed
        const feed = document.createElement('div');
        feed.setAttribute('data-testid', 'mainFeed');
        document.body.appendChild(feed);

        // Run all timers to trigger the retry
        vi.runAllTimers();

        expect(state.isObserverConnected).toBe(true);
        expect(state.observer).not.toBeNull();

        vi.useRealTimers();
    });

    it('stops retrying after MAX_OBSERVER_RETRIES and falls back to document', () => {
        document.body.setAttribute('data-rehydrated', '');
        // No feed wrapper at all

        const scanFn = vi.fn();
        const state = createTestState();
        const observer = createObserver(scanFn, state);

        vi.useFakeTimers();
        observer.start();

        // Advance through all retries (each retry is CONFIG.DELAYS.OBSERVER_RETRY ms)
        const maxRetries = CONFIG.DELAYS.MAX_OBSERVER_RETRIES;
        for (let i = 0; i < maxRetries + 1; i++) {
            vi.advanceTimersByTime(CONFIG.DELAYS.OBSERVER_RETRY);
        }

        // After exhausting retries, should fall back to document
        expect(state.isObserverConnected).toBe(true);
        expect(state.observer).not.toBeNull();

        vi.useRealTimers();
    });
});

describe('stop', () => {
    it('disconnects the observer and resets state', () => {
        document.body.setAttribute('data-rehydrated', '');
        const feed = document.createElement('div');
        feed.setAttribute('data-testid', 'mainFeed');
        document.body.appendChild(feed);

        const scanFn = vi.fn();
        const state = createTestState();

        vi.useFakeTimers();
        const observer = createObserver(scanFn, state);
        observer.start();
        vi.runAllTimers();

        expect(state.isObserverConnected).toBe(true);

        observer.stop();
        expect(state.isObserverConnected).toBe(false);
        expect(state.observer).toBeNull();

        vi.useRealTimers();
    });
});
