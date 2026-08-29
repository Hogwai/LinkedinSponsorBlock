import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS, DEFAULT_SETTINGS } from '../shared/settings.js';
import { createFloatingUI } from './ui.js';
import { createUserscriptStorage } from './storage.js';
import { REMOTE_CONFIG_URL, applyRemoteConfig } from '../shared/remote-config.js';
import { createBlocker } from '../shared/blocker.js';

// ==================== STORAGE ====================
const settingsStorage = createUserscriptStorage(localStorage, (operation, key, error) => {
    logger.warn(`localStorage ${operation} failed for ${key}`, error);
});
const getStored = settingsStorage.get;
const setStored = settingsStorage.set;

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
    pollingInterval: null,
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
        [SETTINGS_KEYS.POSITION]: getStored(SETTINGS_KEYS.POSITION, DEFAULT_SETTINGS[SETTINGS_KEYS.POSITION]),
        [SETTINGS_KEYS.LOGGING]: getStored(SETTINGS_KEYS.LOGGING, DEFAULT_SETTINGS[SETTINGS_KEYS.LOGGING]),
        [SETTINGS_KEYS.HIDE_FLOATING_UI]: settingsStorage.getBoolean(
            SETTINGS_KEYS.HIDE_FLOATING_UI,
            DEFAULT_SETTINGS[SETTINGS_KEYS.HIDE_FLOATING_UI]
        )
    },
    ui: null
};

// Record install date on first run
if (!getStored(SETTINGS_KEYS.INSTALL_DATE, 0)) {
    setStored(SETTINGS_KEYS.INSTALL_DATE, Date.now());
}

// ==================== BLOCKER ====================
const blocker = createBlocker({
    state,
    onBlocked({ promoted, suggested }) {
        const totals = addToTotalCounters(promoted, suggested);
        const sessionTotal = state.sessionPromotedRemoved + state.sessionSuggestedRemoved;
        if (state.ui) {
            state.ui.updateCounters(sessionTotal, totals.promoted, totals.suggested);
        }
    }
});
const { scanFeed } = blocker;

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    blocker.resetSessionCounters();
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
        },
        onToggleLogging(enabled) {
            state.settings[SETTINGS_KEYS.LOGGING] = enabled;
            setStored(SETTINGS_KEYS.LOGGING, enabled);
            logger.setEnabled(enabled);
        },
        onToggleHideFloatingUI(hidden) {
            state.settings[SETTINGS_KEYS.HIDE_FLOATING_UI] = hidden;
            setStored(SETTINGS_KEYS.HIDE_FLOATING_UI, hidden);
        },
        isFeedPage: () => state.isCurrentlyFeedPage
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
// With @grant, Tampermonkey runs in a sandbox: use unsafeWindow to patch the page's real history
const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
const originalPushState = pageWindow.history.pushState;
const originalReplaceState = pageWindow.history.replaceState;

pageWindow.history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
};

pageWindow.history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
};

pageWindow.addEventListener('popstate', handleUrlChange);

state.isCurrentlyFeedPage = isFeedPage();

function setRemoteDebugStatus(status) {
    const payload = {
        ...status,
        at: new Date().toISOString()
    };

    try {
        localStorage.setItem('lsb_remote_status', JSON.stringify(payload));
    } catch { /* ignored */ }

    try {
        pageWindow.__LinkedinSponsorBlockRemote = payload;
    } catch { /* ignored */ }

    logger.info(`Remote status ${JSON.stringify(payload)}`);
}

async function getUserscriptValue(key) {
    try {
        if (typeof GM_getValue !== 'undefined') return GM_getValue(key, null);
        if (typeof GM !== 'undefined' && GM.getValue) return await GM.getValue(key, null);
    } catch (err) {
        setRemoteDebugStatus({ phase: 'storage-get-failed', error: String(err) });
    }

    try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : null;
    } catch { return null; }
}

async function setUserscriptValue(key, value) {
    try {
        if (typeof GM_setValue !== 'undefined') GM_setValue(key, value);
        else if (typeof GM !== 'undefined' && GM.setValue) await GM.setValue(key, value);
    } catch (err) {
        setRemoteDebugStatus({ phase: 'gm-storage-set-failed', error: String(err) });
    }

    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        setRemoteDebugStatus({ phase: 'local-storage-set-failed', error: String(err) });
    }
}

function start() {
    logger.setEnabled(state.settings[SETTINGS_KEYS.LOGGING]);
    applyRemoteConfig({
        async get(key) {
            return await getUserscriptValue(key);
        },
        async set(key, value) {
            await setUserscriptValue(key, value);
            setRemoteDebugStatus({ phase: 'stored', key });
        }
    }, () => new Promise((resolve, reject) => {
        const request = (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest)
            || (typeof GM !== 'undefined' && GM.xmlHttpRequest);

        if (!request) {
            setRemoteDebugStatus({ phase: 'no-request-api' });
            reject(new Error('No userscript HTTP request API available'));
            return;
        }

        setRemoteDebugStatus({ phase: 'fetching', url: REMOTE_CONFIG_URL });
        logger.info(`Fetching remote config: ${REMOTE_CONFIG_URL}`);
        request({
            method: 'GET',
            url: REMOTE_CONFIG_URL,
            timeout: 5000,
            onload(res) {
                setRemoteDebugStatus({ phase: 'response', status: res.status });
                logger.info(`Remote config response status: ${res.status}`);
                try {
                    resolve(res.status === 200 ? JSON.parse(res.responseText) : null);
                } catch (err) {
                    setRemoteDebugStatus({ phase: 'parse-failed', error: String(err) });
                    logger.warn('Remote config response JSON parse failed', err);
                    resolve(null);
                }
            },
            onerror() {
                setRemoteDebugStatus({ phase: 'request-error' });
                reject(new Error('GM_xmlhttpRequest failed'));
            },
            ontimeout() {
                setRemoteDebugStatus({ phase: 'request-timeout' });
                reject(new Error('GM_xmlhttpRequest timeout'));
            }
        });
    }));
    initUI();
    if (state.isCurrentlyFeedPage) {
        if (state.settings[SETTINGS_KEYS.ENABLED]) observer.start();
    } else {
        state.ui.hide();
    }
    state.pollingInterval = setInterval(handleUrlChange, 1000);
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
