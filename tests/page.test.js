import { describe, it, expect, beforeEach } from 'vitest';

describe('page.js', () => {
    beforeEach(() => {
        // Reset location between tests
        window.location = new URL('https://www.linkedin.com/');
    });

    describe('isFeedPage', () => {
        it('returns true for root path', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/';
            expect(isFeedPage()).toBe(true);
        });

        it('returns true for /feed paths', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/feed/';
            expect(isFeedPage()).toBe(true);
        });

        it('returns true for /preload paths', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/preload/';
            expect(isFeedPage()).toBe(true);
        });

        it('returns false for non-feed paths', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/messaging/';
            expect(isFeedPage()).toBe(false);
        });

        it('returns false for /jobs paths', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/jobs/';
            expect(isFeedPage()).toBe(false);
        });

        it('returns false for /notifications paths', async () => {
            const { isFeedPage } = await import('../src/shared/page.js');
            window.location.pathname = '/notifications/';
            expect(isFeedPage()).toBe(false);
        });
    });

    describe('createPageManager', () => {
        it('creates a page manager with handleUrlChange', async () => {
            const { createPageManager } = await import('../src/shared/page.js');
            const state = { isCurrentlyFeedPage: false };
            const observer = { start: () => {}, stop: () => {} };
            const pm = createPageManager(state, observer, () => {});
            expect(pm).toHaveProperty('handleUrlChange');
        });

        it('starts observer when navigating to feed', async () => {
            const { createPageManager } = await import('../src/shared/page.js');
            const state = { isCurrentlyFeedPage: false };
            let started = false;
            let stopped = false;
            let resetCalled = false;
            const observer = {
                start: () => { started = true; },
                stop: () => { stopped = true; }
            };
            const pm = createPageManager(state, observer, () => { resetCalled = true; });
            window.location.pathname = '/';
            pm.handleUrlChange();
            expect(stopped).toBe(true);
            expect(resetCalled).toBe(true);
            expect(started).toBe(true);
        });

        it('stops observer when navigating away from feed', async () => {
            const { createPageManager } = await import('../src/shared/page.js');
            const state = { isCurrentlyFeedPage: true };
            let stopped = false;
            const observer = { start: () => {}, stop: () => { stopped = true; } };
            const pm = createPageManager(state, observer, () => {});
            window.location.pathname = '/messaging/';
            pm.handleUrlChange();
            expect(stopped).toBe(true);
            expect(state.isCurrentlyFeedPage).toBe(false);
        });

        it('does nothing when staying on feed', async () => {
            const { createPageManager } = await import('../src/shared/page.js');
            const state = { isCurrentlyFeedPage: true };
            let observerCalled = false;
            const observer = {
                start: () => { observerCalled = true; },
                stop: () => { observerCalled = true; }
            };
            const pm = createPageManager(state, observer, () => {});
            window.location.pathname = '/feed/';
            pm.handleUrlChange();
            expect(observerCalled).toBe(false);
        });
    });
});
