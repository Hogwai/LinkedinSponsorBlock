import { logger } from '../shared/logger.js';
import { createObserver } from '../shared/observer.js';
import { isScannablePage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS } from '../shared/settings.js';
import api from './browser-api.js';
import { applyRemoteConfig } from '../shared/remote-config.js';
import { createBlocker } from '../shared/blocker.js';
import { createNotifier } from './notifier.js';
import { MESSAGE_TYPES, createFetchRemoteConfigMessage } from '../shared/messages.js';

// ==================== STATE ====================
const state = {
    observer: null,
    waiter: null,
    sessionPromotedRemoved: 0,
    sessionSuggestedRemoved: 0,
    sessionPostsScanned: 0,
    isObserverConnected: false,
    isCurrentlyScannable: false,
    settings: {
        [SETTINGS_KEYS.ENABLED]: true,
        [SETTINGS_KEYS.FILTER_PROMOTED]: true,
        [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true,
        [SETTINGS_KEYS.LOGGING]: false,
        [SETTINGS_KEYS.VERBOSE_LOGGING]: false,
    },
};

// ==================== NOTIFIER ====================
const notifier = createNotifier({
    state,
    sendMessage: (message) => api.runtime.sendMessage(message),
});

// ==================== BLOCKER ====================
const blocker = createBlocker({
    state,
    onBlocked() {
        notifier.queue();
    },
});
const { scanFeed } = blocker;

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    blocker.resetSessionCounters();
    notifier.reset();
});

// ==================== SETTINGS ====================
const SYNCED_SETTINGS_KEYS = [
    SETTINGS_KEYS.ENABLED,
    SETTINGS_KEYS.FILTER_PROMOTED,
    SETTINGS_KEYS.FILTER_SUGGESTED,
    SETTINGS_KEYS.FILTER_RECOMMENDED,
    SETTINGS_KEYS.LOGGING,
    SETTINGS_KEYS.VERBOSE_LOGGING,
];

async function loadSettings() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.ENABLED]: true,
        [SETTINGS_KEYS.FILTER_PROMOTED]: true,
        [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true,
        [SETTINGS_KEYS.LOGGING]: false,
        [SETTINGS_KEYS.VERBOSE_LOGGING]: false,
    });
    state.settings = result;
    logger.setVerbose(result[SETTINGS_KEYS.VERBOSE_LOGGING] || false);
    logger.setEnabled(result[SETTINGS_KEYS.LOGGING] || false);
}

function updateSettings(newSettings) {
    if (newSettings[SETTINGS_KEYS.ENABLED] !== undefined) {
        state.settings[SETTINGS_KEYS.ENABLED] = newSettings[SETTINGS_KEYS.ENABLED];
        if (!state.settings[SETTINGS_KEYS.ENABLED]) {
            observer.stop();
            notifier.cancel();
        } else if (state.isCurrentlyScannable) {
            observer.start();
        }
    }
    if (newSettings[SETTINGS_KEYS.FILTER_PROMOTED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_PROMOTED] = newSettings[SETTINGS_KEYS.FILTER_PROMOTED];
    }
    if (newSettings[SETTINGS_KEYS.FILTER_SUGGESTED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_SUGGESTED] =
            newSettings[SETTINGS_KEYS.FILTER_SUGGESTED];
    }
    if (newSettings[SETTINGS_KEYS.FILTER_RECOMMENDED] !== undefined) {
        state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED] =
            newSettings[SETTINGS_KEYS.FILTER_RECOMMENDED];
    }
    if (newSettings[SETTINGS_KEYS.LOGGING] !== undefined) {
        state.settings[SETTINGS_KEYS.LOGGING] = newSettings[SETTINGS_KEYS.LOGGING];
        logger.setEnabled(newSettings[SETTINGS_KEYS.LOGGING]);
    }
    if (newSettings[SETTINGS_KEYS.VERBOSE_LOGGING] !== undefined) {
        state.settings[SETTINGS_KEYS.VERBOSE_LOGGING] = newSettings[SETTINGS_KEYS.VERBOSE_LOGGING];
        logger.setVerbose(newSettings[SETTINGS_KEYS.VERBOSE_LOGGING]);
    }
}

// ==================== INIT ====================
document.addEventListener('visibilitychange', () => {
    if (!state.isCurrentlyScannable) return;
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return;
    if (document.hidden) observer.stop();
    else observer.start();
});

window.addEventListener('pagehide', () => {
    notifier.cancel();
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.URL_CHANGED) {
        pageManager.handleUrlChange();
    } else if (message.type === MESSAGE_TYPES.MANUAL_SCAN) {
        // Report what this scan blocked
        sendResponse(scanFeed());
        return true;
    } else if (message.type === MESSAGE_TYPES.SETTINGS_CHANGED) {
        updateSettings(message);
    }
});

// Keep every LinkedIn tab in sync: the popup writes settings to storage and
// only messages the active tab.
api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const next = {};
    for (const key of SYNCED_SETTINGS_KEYS) {
        if (changes[key]) next[key] = changes[key].newValue;
    }
    if (Object.keys(next).length > 0) updateSettings(next);
});

async function init() {
    await loadSettings();
    await applyRemoteConfig(
        {
            async get(key) {
                const result = await api.storage.local.get({ [key]: null });
                return result[key];
            },
            async set(key, value) {
                await api.storage.local.set({ [key]: value });
            },
        },
        () => api.runtime.sendMessage(createFetchRemoteConfigMessage()),
    );
    state.isCurrentlyScannable = isScannablePage();

    if (document.body) {
        if (state.isCurrentlyScannable && state.settings[SETTINGS_KEYS.ENABLED]) {
            observer.start();
        }
    } else {
        state.waiter = new MutationObserver(() => {
            if (document.body) {
                state.waiter.disconnect();
                state.waiter = null;
                if (state.isCurrentlyScannable && state.settings[SETTINGS_KEYS.ENABLED])
                    observer.start();
            }
        });
        state.waiter.observe(document.documentElement, { childList: true });
    }
}

init();
