import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { getUnscannedPosts } from '../shared/detection.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS } from '../shared/settings.js';
import api from './browser-api.js';

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
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true
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
                            api.runtime.sendMessage({
                                type: "BLOCKED",
                                promoted: newPromoted,
                                suggested: newSuggested
                            }).catch(() => { });
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

// ==================== HIDE FUNCTIONS ====================
function hideSuggestedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionSuggestedRemoved++;
    notifier.queue();
    logger.log(`Suggested post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

function hideRecommendedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionSuggestedRemoved++;
    notifier.queue();
    logger.log(`Recommended post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

function hidePromotedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionPromotedRemoved++;
    notifier.queue();
    logger.log(`Promoted post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

// ==================== SCAN ====================
function scanFeed(root = document) {
    if (!state.settings[SETTINGS_KEYS.ENABLED]) {
        return { promoted: 0, suggested: 0 };
    }

    const groupedPosts = getUnscannedPosts(root);
    let promotedCount = 0;
    let suggestedCount = 0;

    if (state.settings[SETTINGS_KEYS.FILTER_PROMOTED]) {
        for (const post of groupedPosts.sponsored) {
            if (hidePromotedPost(post)) {
                promotedCount += 1;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (state.settings[SETTINGS_KEYS.FILTER_SUGGESTED]) {
        for (const post of groupedPosts.suggested) {
            if (hideSuggestedPost(post)) {
                suggestedCount += 1;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED]) {
        for (const post of groupedPosts.recommended) {
            if (hideRecommendedPost(post)) {
                suggestedCount += 1;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (promotedCount > 0 || suggestedCount > 0) {
        notifier.queue();
    }

    return { promoted: promotedCount, suggested: suggestedCount };
}

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    state.sessionPromotedRemoved = 0;
    state.sessionSuggestedRemoved = 0;
    notifier.reset();
});

// ==================== SETTINGS ====================
async function loadSettings() {
    const result = await api.storage.local.get({
        [SETTINGS_KEYS.ENABLED]: true,
        [SETTINGS_KEYS.FILTER_PROMOTED]: true,
        [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: true
    });
    state.settings = result;
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
}

// ==================== INIT ====================
document.addEventListener('visibilitychange', () => {
    if (!state.isCurrentlyFeedPage) return;
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return;
    document.hidden ? observer.stop() : observer.start();
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'URL_CHANGED') {
        pageManager.handleUrlChange();
    } else if (message.type === 'MANUAL_SCAN') {
        const result = scanFeed();
        sendResponse(result);
        observer.stop();
        observer.start();
        return true;
    } else if (message.type === 'SETTINGS_CHANGED') {
        updateSettings(message);
    }
});

async function init() {
    await loadSettings();
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
