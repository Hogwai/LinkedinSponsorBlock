import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUrlWatcher } from '../src/userscript/url-watcher.js';

function createFakeWindow(initialUrl = 'https://www.linkedin.com/feed/') {
    const listeners = new Map();
    const history = {
        pushState: vi.fn(),
        replaceState: vi.fn(),
    };
    const pageWindow = {
        location: { href: initialUrl },
        history,
        addEventListener: vi.fn((type, handler) => {
            listeners.set(type, handler);
        }),
        removeEventListener: vi.fn((type, handler) => {
            if (listeners.get(type) === handler) listeners.delete(type);
        }),
    };

    return { pageWindow, history, listeners };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createUrlWatcher', () => {
    it('notifies on pushState, popstate and polling only when the URL changes', () => {
        const { pageWindow, listeners } = createFakeWindow();
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();

        pageWindow.location.href = 'https://www.linkedin.com/feed/update/1';
        pageWindow.history.pushState({}, '', '/feed/update/1');
        expect(onChange).toHaveBeenCalledTimes(1);

        pageWindow.history.replaceState({}, '', '/feed/update/1');
        expect(onChange).toHaveBeenCalledTimes(1);

        pageWindow.location.href = 'https://www.linkedin.com/jobs/';
        listeners.get('popstate')();
        expect(onChange).toHaveBeenCalledTimes(2);

        pageWindow.location.href = 'https://www.linkedin.com/feed/update/2';
        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(3);

        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('restores history and removes listeners when stopped', () => {
        const { pageWindow, history, listeners } = createFakeWindow();
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();
        watcher.stop();

        expect(history.pushState).toBe(originalPushState);
        expect(history.replaceState).toBe(originalReplaceState);
        expect(listeners.has('popstate')).toBe(false);

        pageWindow.location.href = 'https://www.linkedin.com/jobs/';
        history.pushState({}, '', '/jobs/');
        vi.advanceTimersByTime(5000);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('is idempotent and can be restarted', () => {
        const { pageWindow } = createFakeWindow();
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();
        watcher.start();
        expect(pageWindow.addEventListener).toHaveBeenCalledTimes(1);

        watcher.stop();
        watcher.stop();
        expect(pageWindow.removeEventListener).toHaveBeenCalledTimes(1);

        watcher.start();
        pageWindow.location.href = 'https://www.linkedin.com/jobs/';
        pageWindow.history.pushState({}, '', '/jobs/');

        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
