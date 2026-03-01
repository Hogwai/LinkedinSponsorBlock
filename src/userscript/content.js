import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { getUnscannedPosts } from '../shared/detection.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS, DEFAULT_SETTINGS } from '../shared/settings.js';
import { createFloatingUI } from './ui.js';

// ==================== STORAGE ====================
const STORAGE_PREFIX = 'lsb_';

function getStored(key, defaultValue) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function setStored(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch { /* storage full or unavailable */ }
}

function getTotalCounters() {
    return {
        promoted: getStored(SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED, 0),
        suggested: getStored(SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED, 0)
    };
}

function addToTotalCounters(promoted, suggested) {
    const current = getTotalCounters();
    const updated = {
        promoted: current.promoted + promoted,
        suggested: current.suggested + suggested
    };
    setStored(SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED, updated.promoted);
    setStored(SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED, updated.suggested);
    return updated;
}

function resetTotalCounters() {
    setStored(SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED, 0);
    setStored(SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED, 0);
}

// ==================== STATE ====================
const state = {
    observer: null,
    waiter: null,
    sessionPromotedRemoved: 0,
    sessionSuggestedRemoved: 0,
    isObserverConnected: false,
    isCurrentlyFeedPage: false,
    settings: {
        [SETTINGS_KEYS.ENABLED]: getStored(SETTINGS_KEYS.ENABLED, DEFAULT_SETTINGS[SETTINGS_KEYS.ENABLED]),
        [SETTINGS_KEYS.DISCREET]: getStored(SETTINGS_KEYS.DISCREET, DEFAULT_SETTINGS[SETTINGS_KEYS.DISCREET]),
        [SETTINGS_KEYS.FILTER_PROMOTED]: getStored(SETTINGS_KEYS.FILTER_PROMOTED, DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_PROMOTED]),
        [SETTINGS_KEYS.FILTER_SUGGESTED]: getStored(SETTINGS_KEYS.FILTER_SUGGESTED, DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_SUGGESTED]),
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: getStored(SETTINGS_KEYS.FILTER_RECOMMENDED, DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_RECOMMENDED]),
        [SETTINGS_KEYS.LANGUAGE]: getStored(SETTINGS_KEYS.LANGUAGE, DEFAULT_SETTINGS[SETTINGS_KEYS.LANGUAGE]),
        [SETTINGS_KEYS.POSITION]: getStored(SETTINGS_KEYS.POSITION, DEFAULT_SETTINGS[SETTINGS_KEYS.POSITION])
    },
    ui: null
};

// Record install date on first run
if (!getStored(SETTINGS_KEYS.INSTALL_DATE, 0)) {
    setStored(SETTINGS_KEYS.INSTALL_DATE, Date.now());
}

// ==================== HIDE FUNCTIONS ====================
function hidePromotedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionPromotedRemoved++;
    logger.log(`Promoted post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

function hideSuggestedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionSuggestedRemoved++;
    logger.log(`Suggested post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

function hideRecommendedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionSuggestedRemoved++;
    logger.log(`Recommended post hidden: "${post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100)}"`);
    return true;
}

// ==================== SCAN ====================
function scanFeed(root = document) {
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return { promoted: 0, suggested: 0 };

    const groupedPosts = getUnscannedPosts(root);
    let promotedCount = 0;
    let suggestedCount = 0;

    if (state.settings[SETTINGS_KEYS.FILTER_PROMOTED]) {
        for (const post of groupedPosts.sponsored) {
            if (hidePromotedPost(post)) {
                promotedCount++;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (state.settings[SETTINGS_KEYS.FILTER_SUGGESTED]) {
        for (const post of groupedPosts.suggested) {
            if (hideSuggestedPost(post)) {
                suggestedCount++;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED]) {
        for (const post of groupedPosts.recommended) {
            if (hideRecommendedPost(post)) {
                suggestedCount++;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }
    }

    if (promotedCount > 0 || suggestedCount > 0) {
        const totals = addToTotalCounters(promotedCount, suggestedCount);
        const sessionTotal = state.sessionPromotedRemoved + state.sessionSuggestedRemoved;
        if (state.ui) {
            state.ui.updateCounters(sessionTotal, totals.promoted, totals.suggested);
        }
    }

    return { promoted: promotedCount, suggested: suggestedCount };
}

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    state.sessionPromotedRemoved = 0;
    state.sessionSuggestedRemoved = 0;
    if (state.ui) {
        const totals = getTotalCounters();
        state.ui.updateCounters(0, totals.promoted, totals.suggested);
    }
});

// ==================== UI ====================
function initUI() {
    const totals = getTotalCounters();
    state.ui = createFloatingUI({
        settings: {
            ...state.settings,
            installDate: getStored(SETTINGS_KEYS.INSTALL_DATE, 0),
            reviewThresholdDays: CONFIG.REVIEW_THRESHOLD_DAYS,
            reviewUrl: CONFIG.REVIEW_URLS.userscript,
            githubUrl: CONFIG.GITHUB_URL,
            reviewBannerDismissed: getStored(SETTINGS_KEYS.REVIEW_BANNER_DISMISSED, false),
            onDismissBanner() {
                setStored(SETTINGS_KEYS.REVIEW_BANNER_DISMISSED, true);
            }
        },
        counters: totals,
        onToggleEnabled(enabled) {
            state.settings[SETTINGS_KEYS.ENABLED] = enabled;
            setStored(SETTINGS_KEYS.ENABLED, enabled);
            if (!enabled) {
                observer.stop();
            } else if (state.isCurrentlyFeedPage) {
                observer.start();
            }
        },
        onToggleDiscreet(discreet) {
            state.settings[SETTINGS_KEYS.DISCREET] = discreet;
            setStored(SETTINGS_KEYS.DISCREET, discreet);
        },
        onTogglePromoted(enabled) {
            state.settings[SETTINGS_KEYS.FILTER_PROMOTED] = enabled;
            setStored(SETTINGS_KEYS.FILTER_PROMOTED, enabled);
        },
        onToggleSuggested(enabled) {
            state.settings[SETTINGS_KEYS.FILTER_SUGGESTED] = enabled;
            setStored(SETTINGS_KEYS.FILTER_SUGGESTED, enabled);
        },
        onToggleRecommended(enabled) {
            state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED] = enabled;
            setStored(SETTINGS_KEYS.FILTER_RECOMMENDED, enabled);
        },
        onScan() {
            return scanFeed();
        },
        getCounters() {
            const totals = getTotalCounters();
            return {
                sessionTotal: state.sessionPromotedRemoved + state.sessionSuggestedRemoved,
                totalPromoted: totals.promoted,
                totalSuggested: totals.suggested
            };
        },
        onLanguageChange(lang) {
            state.settings[SETTINGS_KEYS.LANGUAGE] = lang;
            setStored(SETTINGS_KEYS.LANGUAGE, lang);
        },
        onPositionChange(pos) {
            state.settings[SETTINGS_KEYS.POSITION] = pos;
            setStored(SETTINGS_KEYS.POSITION, pos);
        }
    });
}

// ==================== INIT ====================
document.addEventListener('visibilitychange', () => {
    if (!state.isCurrentlyFeedPage) return;
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return;
    document.hidden ? observer.stop() : observer.start();
});

// URL change detection (SPA-compatible)
let lastUrl = location.href;

function handleUrlChange() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        pageManager.handleUrlChange();
        if (state.ui) {
            state.isCurrentlyFeedPage ? state.ui.show() : state.ui.hide();
        }
    }
}

// Listen to history changes (SPA navigation)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
};

history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
};

window.addEventListener('popstate', handleUrlChange);

// Fallback polling for edge cases
setInterval(handleUrlChange, 1000);

state.isCurrentlyFeedPage = isFeedPage();

function start() {
    initUI();
    if (state.isCurrentlyFeedPage) {
        if (state.settings[SETTINGS_KEYS.ENABLED]) observer.start();
    } else {
        state.ui.hide();
    }
}

if (document.body) {
    start();
} else {
    state.waiter = new MutationObserver(() => {
        if (document.body) {
            state.waiter.disconnect();
            state.waiter = null;
            start();
        }
    });
    state.waiter.observe(document.documentElement, { childList: true });
}
