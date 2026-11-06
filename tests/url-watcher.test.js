import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUrlWatcher } from '../src/userscript/url-watcher.js';

function createFakeWindow(initialUrl = 'https://www.linkedin.com/feed/') {
    const windowListeners = new Map();
    const documentListeners = new Map();
    const history = {
        pushState: vi.fn(),
        replaceState: vi.fn(),
    };
    const parsed = new URL(initialUrl);
    const location = {
        href: parsed.href,
        pathname: parsed.pathname,
        search: parsed.search,
    };
    const document = {
        hidden: false,
        addEventListener: vi.fn((type, handler) => documentListeners.set(type, handler)),
        removeEventListener: vi.fn((type, handler) => {
            if (documentListeners.get(type) === handler) documentListeners.delete(type);
        }),
    };
    const pageWindow = {
        location,
        history,
        document,
        addEventListener: vi.fn((type, handler) => windowListeners.set(type, handler)),
        removeEventListener: vi.fn((type, handler) => {
            if (windowListeners.get(type) === handler) windowListeners.delete(type);
        }),
    };

    function setUrl(url) {
        const next = new URL(url);
        location.href = next.href;
        location.pathname = next.pathname;
        location.search = next.search;
    }

    return { pageWindow, history, document, windowListeners, documentListeners, setUrl };
}

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createUrlWatcher', () => {
    it('notifies on pushState, popstate and polling only when the path changes', () => {
        const { pageWindow, windowListeners, setUrl } = createFakeWindow();
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();

        setUrl('https://www.linkedin.com/feed/update/1');
        pageWindow.history.pushState({}, '', '/feed/update/1');
        expect(onChange).toHaveBeenCalledTimes(1);

        pageWindow.history.replaceState({}, '', '/feed/update/1');
        expect(onChange).toHaveBeenCalledTimes(1);

        // Hash-only navigation must not trigger a full rescan.
        setUrl('https://www.linkedin.com/feed/update/1#comments');
        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(1);

        setUrl('https://www.linkedin.com/jobs/');
        windowListeners.get('popstate')();
        expect(onChange).toHaveBeenCalledTimes(2);

        setUrl('https://www.linkedin.com/feed/update/2');
        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(3);

        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('restores history and removes listeners when stopped', () => {
        const { pageWindow, history, windowListeners, documentListeners } = createFakeWindow();
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();
        watcher.stop();

        expect(history.pushState).toBe(originalPushState);
        expect(history.replaceState).toBe(originalReplaceState);
        expect(windowListeners.has('popstate')).toBe(false);
        expect(documentListeners.has('visibilitychange')).toBe(false);

        pageWindow.location.href = 'https://www.linkedin.com/jobs/';
        history.pushState({}, '', '/jobs/');
        vi.advanceTimersByTime(5000);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('is idempotent and can be restarted', () => {
        const { pageWindow, setUrl } = createFakeWindow();
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();
        watcher.start();
        expect(pageWindow.addEventListener).toHaveBeenCalledTimes(1);
        expect(pageWindow.document.addEventListener).toHaveBeenCalledTimes(1);

        watcher.stop();
        watcher.stop();
        expect(pageWindow.removeEventListener).toHaveBeenCalledTimes(1);
        expect(pageWindow.document.removeEventListener).toHaveBeenCalledTimes(1);

        watcher.start();
        setUrl('https://www.linkedin.com/jobs/');
        pageWindow.history.pushState({}, '', '/jobs/');

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('pauses polling while the document is hidden and checks on return', () => {
        const { pageWindow, document, documentListeners, setUrl } = createFakeWindow();
        const onChange = vi.fn();
        const watcher = createUrlWatcher({ pageWindow, intervalMs: 1000, onChange });

        watcher.start();

        document.hidden = true;
        documentListeners.get('visibilitychange')();
        setUrl('https://www.linkedin.com/jobs/');
        vi.advanceTimersByTime(5000);
        expect(onChange).not.toHaveBeenCalled();

        document.hidden = false;
        documentListeners.get('visibilitychange')();
        expect(onChange).toHaveBeenCalledTimes(1);

        setUrl('https://www.linkedin.com/feed/');
        vi.advanceTimersByTime(1000);
        expect(onChange).toHaveBeenCalledTimes(2);
    });
});
