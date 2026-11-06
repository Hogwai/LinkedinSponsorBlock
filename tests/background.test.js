import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const storage = {};
    const listeners = {};

    const api = {
        storage: {
            local: {
                get: vi.fn(async (defaults = {}) => ({ ...defaults, ...storage })),
                set: vi.fn(async (values) => {
                    Object.assign(storage, values);
                }),
            },
            onChanged: {
                addListener: vi.fn((fn) => {
                    listeners.storageChanged = fn;
                }),
            },
        },
        action: {
            setBadgeText: vi.fn(async () => {}),
            setBadgeBackgroundColor: vi.fn(async () => {}),
        },
        runtime: {
            onMessage: {
                addListener: vi.fn((fn) => {
                    listeners.onMessage = fn;
                }),
            },
            sendMessage: vi.fn(async () => {}),
        },
        tabs: {
            sendMessage: vi.fn(async () => {}),
        },
        webNavigation: {
            onHistoryStateUpdated: {
                addListener: vi.fn((fn) => {
                    listeners.onHistoryStateUpdated = fn;
                }),
            },
            onReferenceFragmentUpdated: {
                addListener: vi.fn((fn) => {
                    listeners.onReferenceFragmentUpdated = fn;
                }),
            },
        },
    };

    return { api, storage, listeners };
});

vi.mock('../src/extension/browser-api.js', () => ({ default: h.api }));

async function loadBackground() {
    vi.resetModules();
    await import('../src/extension/background.js');
    await vi.waitFor(() => expect(h.listeners.onMessage).toBeTypeOf('function'));
    // Let the top-level loadCounters()/recordInstallDate() settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function send(message, sender = {}) {
    const sendResponse = vi.fn();
    const result = h.listeners.onMessage(message, sender, sendResponse);
    return { result, sendResponse };
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(h.storage)) delete h.storage[key];
    delete h.listeners.onMessage;
    delete h.listeners.onHistoryStateUpdated;
    delete h.listeners.storageChanged;
});

describe('updateBadge', () => {
    it('clears the badge when the extension is enabled', async () => {
        await loadBackground();

        h.listeners.onMessage({ type: 'SETTINGS_CHANGED', enabled: true }, {}, vi.fn());

        expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
    });

    it('shows an OFF badge when the extension is disabled', async () => {
        await loadBackground();

        h.listeners.onMessage({ type: 'SETTINGS_CHANGED', enabled: false }, {}, vi.fn());

        expect(h.api.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
            color: '#d72828',
        });
        expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: 'OFF' });
    });
});

describe('BLOCKED messages', () => {
    it('accumulates counters, persists them and acknowledges the sender', async () => {
        await loadBackground();
        const { result, sendResponse } = send(
            { type: 'BLOCKED', promoted: 2, suggested: 3, scanned: 9 },
            { tab: { id: 1 } },
        );

        expect(result).toBe(true);
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));

        expect(h.storage.totalPromotedBlocked).toBe(2);
        expect(h.storage.totalSuggestedBlocked).toBe(3);
        expect(h.storage.totalPostsScanned).toBe(9);
    });

    it('broadcasts the updated counters to extension pages', async () => {
        await loadBackground();
        send({ type: 'BLOCKED', promoted: 1, suggested: 0, scanned: 1 }, { tab: { id: 1 } });

        await vi.waitFor(() =>
            expect(h.api.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'COUNTER_UPDATE',
                promoted: 1,
                suggested: 0,
                scanned: 1,
            }),
        );
    });
});

describe('RESET_COUNTERS messages', () => {
    it('zeros the counters and acknowledges the sender', async () => {
        await loadBackground();
        send({ type: 'BLOCKED', promoted: 2, suggested: 3, scanned: 9 }, { tab: { id: 1 } });
        await vi.waitFor(() => expect(h.storage.totalPromotedBlocked).toBe(2));

        const { result, sendResponse } = send({ type: 'RESET_COUNTERS' });

        expect(result).toBe(true);
        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }));
        expect(h.storage.totalPromotedBlocked).toBe(0);
        expect(h.storage.totalSuggestedBlocked).toBe(0);
        expect(h.storage.totalPostsScanned).toBe(0);
    });
});

describe('GET_COUNTERS messages', () => {
    it('returns the in-memory counters', async () => {
        await loadBackground();
        const { sendResponse } = send({ type: 'GET_COUNTERS' });

        await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled());
        expect(sendResponse).toHaveBeenCalledWith({
            promoted: 0,
            suggested: 0,
            totalPostsScanned: 0,
        });
    });
});

describe('storage sync', () => {
    it('updates the badge when enabled changes in another context', async () => {
        await loadBackground();

        h.listeners.storageChanged({ enabled: { newValue: false } }, 'local');

        expect(h.api.action.setBadgeText).toHaveBeenLastCalledWith({ text: 'OFF' });
    });

    it('ignores changes from other storage areas', async () => {
        await loadBackground();
        h.api.action.setBadgeText.mockClear();

        h.listeners.storageChanged({ enabled: { newValue: false } }, 'sync');

        expect(h.api.action.setBadgeText).not.toHaveBeenCalled();
    });
});

describe('install date', () => {
    it('records the install date on first run', async () => {
        await loadBackground();

        await vi.waitFor(() => expect(h.storage.installDate).toBeTypeOf('number'));
    });
});

describe('storage failures', () => {
    it('falls back to defaults when storage is unavailable', async () => {
        h.api.storage.local.get
            .mockRejectedValueOnce(new Error('counters unavailable'))
            .mockRejectedValueOnce(new Error('install date unavailable'));

        await loadBackground();

        const { sendResponse } = send({ type: 'GET_COUNTERS' });
        await vi.waitFor(() =>
            expect(sendResponse).toHaveBeenCalledWith({
                promoted: 0,
                suggested: 0,
                totalPostsScanned: 0,
            }),
        );
    });
});

describe('webNavigation', () => {
    it('only notifies LinkedIn tabs and swallows missing-receiver errors', async () => {
        await loadBackground();

        h.listeners.onHistoryStateUpdated({ tabId: 1, url: 'https://example.com/feed' });
        expect(h.api.tabs.sendMessage).not.toHaveBeenCalled();

        h.api.tabs.sendMessage.mockRejectedValueOnce(new Error('no receiver'));
        h.listeners.onHistoryStateUpdated({ tabId: 2, url: 'https://www.linkedin.com/feed/' });

        expect(h.api.tabs.sendMessage).toHaveBeenCalledWith(2, {
            type: 'URL_CHANGED',
            url: 'https://www.linkedin.com/feed/',
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});
