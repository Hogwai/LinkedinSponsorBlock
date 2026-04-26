import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS } from '../shared/settings.js';
import api from './browser-api.js';
import { applyRemoteConfig } from '../shared/remote-config.js';
import { createBlocker } from '../shared/blocker.js';
import { MESSAGE_TYPES, createBlockedMessage, createFetchRemoteConfigMessage } from '../shared/messages.js';

// ==================== STATE ====================
const state = {
    observer: null,
    waiter: null,
    sessionPromotedRemoved: 0,
    sessionSuggestedRemoved: 0,
    isObserverConnected: false,
    isCurrentlyFeedPage: false,
    settings: {
        [SETTINGS_KEYS.ENABLED]: true,
        [SETTINGS_KEYS.FILTER_PROMOTED]: true,
        [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true,
        [SETTINGS_KEYS.LOGGING]: false
    }
};

// ==================== NOTIFIER ====================
const notifier = {
    pending: false,
    scheduled: false,
    lastNotifiedPromoted: 0,
    lastNotifiedSuggested: 0,
    queue() {
        this.pending = true;
        if (!this.scheduled) {
            this.scheduled = true;
            setTimeout(() => {
                requestIdleCallback(() => {
                    if (this.pending) {
                        const newPromoted = state.sessionPromotedRemoved - this.lastNotifiedPromoted;
                        const newSuggested = state.sessionSuggestedRemoved - this.lastNotifiedSuggested;

                        if (newPromoted > 0 || newSuggested > 0) {
                            api.runtime.sendMessage(createBlockedMessage({
                                promoted: newPromoted,
                                suggested: newSuggested
                            })).catch(() => { });
                            this.lastNotifiedPromoted = state.sessionPromotedRemoved;
                            this.lastNotifiedSuggested = state.sessionSuggestedRemoved;
                        }

                        this.pending = false;
                    }
                    this.scheduled = false;
                }, { timeout: 500 });
            }, CONFIG.DELAYS.NOTIFICATION);
        }
    },
    reset() {
        this.lastNotifiedPromoted = 0;
        this.lastNotifiedSuggested = 0;
    }
};

// ==================== BLOCKER ====================
const blocker = createBlocker({
    state,
    onBlocked() {
        notifier.queue();
    }
});
const { scanFeed } = blocker;

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    blocker.resetSessionCounters();
    notifier.reset();
});

// ==================== SETTINGS ====================
async function loadSettings() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.ENABLED]: true,
        [SETTINGS_KEYS.FILTER_PROMOTED]: true,
        [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true,
        [SETTINGS_KEYS.LOGGING]: false
    });
    state.settings = result;
    logger.setEnabled(result[SETTINGS_KEYS.LOGGING] || false);
}

function updateSettings(newSettings) {
    if (newSettings[SETTINGS_KEYS.ENABLED] !== undefined) {
        state.settings[SETTINGS_KEYS.ENABLED] = newSettings[SETTINGS_KEYS.ENABLED];
        if (!state.settings[SETTINGS_KEYS.ENABLED]) {
            observer.stop();
        } else if (state.isCurrentlyFeedPage) {
            observer.start();
        }
    }
    if (newSettings[SETTINGS_KEYS.FILTER_PROMOTED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_PROMOTED] = newSettings[SETTINGS_KEYS.FILTER_PROMOTED];
    }
    if (newSettings[SETTINGS_KEYS.FILTER_SUGGESTED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_SUGGESTED] = newSettings[SETTINGS_KEYS.FILTER_SUGGESTED];
    }
    if (newSettings[SETTINGS_KEYS.FILTER_RECOMMENDED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED] = newSettings[SETTINGS_KEYS.FILTER_RECOMMENDED];
    }
    if (newSettings[SETTINGS_KEYS.LOGGING] !== undefined) {
        state.settings[SETTINGS_KEYS.LOGGING] = newSettings[SETTINGS_KEYS.LOGGING];
        logger.setEnabled(newSettings[SETTINGS_KEYS.LOGGING]);
    }
}

// ==================== INIT ====================
document.addEventListener('visibilitychange', () => {
    if (!state.isCurrentlyFeedPage) return;
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return;
    document.hidden ? observer.stop() : observer.start();
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.URL_CHANGED) {
        pageManager.handleUrlChange();
    } else if (message.type === MESSAGE_TYPES.MANUAL_SCAN) {
        const result = scanFeed();
        sendResponse(result);
        observer.stop();
        observer.start();
        return true;
    } else if (message.type === MESSAGE_TYPES.SETTINGS_CHANGED) {
        updateSettings(message);
    }
});

async function init() {
    await loadSettings();
    await applyRemoteConfig({
        async get(key) {
            const result = await api.storage.local.get({ [key]: null });
            return result[key];
        },
        async set(key, value) {
            await api.storage.local.set({ [key]: value });
        }
    }, () => api.runtime.sendMessage(createFetchRemoteConfigMessage()));
    state.isCurrentlyFeedPage = isFeedPage();

    if (document.body) {
        if (state.isCurrentlyFeedPage && state.settings[SETTINGS_KEYS.ENABLED]) observer.start();
    } else {
        state.waiter = new MutationObserver(() => {
            if (document.body) {
                state.waiter.disconnect();
                state.waiter = null;
                if (state.isCurrentlyFeedPage && state.settings[SETTINGS_KEYS.ENABLED]) observer.start();
            }
        });
        state.waiter.observe(document.documentElement, { childList: true });
    }
}

init();
