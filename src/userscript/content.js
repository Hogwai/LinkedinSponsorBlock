import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, isScannablePage, createPageManager } from '../shared/page.js';
import { SETTINGS_KEYS, DEFAULT_SETTINGS } from '../shared/settings.js';
import { createFloatingUI } from './ui.js';
import { createUserscriptStorage, STORAGE_PREFIX } from './storage.js';
import { createUrlWatcher } from './url-watcher.js';
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
        suggested: getStored(SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED, 0),
    };
}

async function addToTotalCounters(promoted, suggested) {
    const apply = () => {
        const current = getTotalCounters();
        const updated = {
            promoted: current.promoted + promoted,
            suggested: current.suggested + suggested,
        };
        setStored(SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED, updated.promoted);
        setStored(SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED, updated.suggested);
        return updated;
    };

    // Serialize the read-modify-write across tabs when Web Locks is available;
    // two tabs hiding posts at the same time must not lose an increment.
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        try {
            return await navigator.locks.request('lsb-counters', apply);
        } catch {
            // Lock unavailable (e.g. document not fully active): best effort.
            return apply();
        }
    }
    return apply();
}

// ==================== STATE ====================
const state = {
    observer: null,
    waiter: null,
    sessionPromotedRemoved: 0,
    sessionSuggestedRemoved: 0,
    isObserverConnected: false,
    isCurrentlyScannable: false,
    settings: {
        [SETTINGS_KEYS.ENABLED]: getStored(
            SETTINGS_KEYS.ENABLED,
            DEFAULT_SETTINGS[SETTINGS_KEYS.ENABLED],
        ),
        [SETTINGS_KEYS.DISCREET]: getStored(
            SETTINGS_KEYS.DISCREET,
            DEFAULT_SETTINGS[SETTINGS_KEYS.DISCREET],
        ),
        [SETTINGS_KEYS.FILTER_PROMOTED]: getStored(
            SETTINGS_KEYS.FILTER_PROMOTED,
            DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_PROMOTED],
        ),
        [SETTINGS_KEYS.FILTER_SUGGESTED]: getStored(
            SETTINGS_KEYS.FILTER_SUGGESTED,
            DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_SUGGESTED],
        ),
        [SETTINGS_KEYS.FILTER_RECOMMENDED]: getStored(
            SETTINGS_KEYS.FILTER_RECOMMENDED,
            DEFAULT_SETTINGS[SETTINGS_KEYS.FILTER_RECOMMENDED],
        ),
        [SETTINGS_KEYS.LANGUAGE]: getStored(SETTINGS_KEYS.LANGUAGE, null),
        [SETTINGS_KEYS.POSITION]: getStored(
            SETTINGS_KEYS.POSITION,
            DEFAULT_SETTINGS[SETTINGS_KEYS.POSITION],
        ),
        [SETTINGS_KEYS.LOGGING]: getStored(
            SETTINGS_KEYS.LOGGING,
            DEFAULT_SETTINGS[SETTINGS_KEYS.LOGGING],
        ),
        [SETTINGS_KEYS.VERBOSE_LOGGING]: getStored(
            SETTINGS_KEYS.VERBOSE_LOGGING,
            DEFAULT_SETTINGS[SETTINGS_KEYS.VERBOSE_LOGGING],
        ),
        [SETTINGS_KEYS.HIDE_FLOATING_UI]: settingsStorage.getBoolean(
            SETTINGS_KEYS.HIDE_FLOATING_UI,
            DEFAULT_SETTINGS[SETTINGS_KEYS.HIDE_FLOATING_UI],
        ),
    },
    ui: null,
};

// Record install date on first run
if (!getStored(SETTINGS_KEYS.INSTALL_DATE, 0)) {
    setStored(SETTINGS_KEYS.INSTALL_DATE, Date.now());
}

// ==================== BLOCKER ====================
const blocker = createBlocker({
    state,
    onBlocked({ promoted, suggested }) {
        if (promoted === 0 && suggested === 0) return;

        const sessionTotal = state.sessionPromotedRemoved + state.sessionSuggestedRemoved;
        addToTotalCounters(promoted, suggested)
            .then((totals) => {
                state.ui?.updateCounters(sessionTotal, totals.promoted, totals.suggested);
            })
            .catch(() => {
                const totals = getTotalCounters();
                state.ui?.updateCounters(sessionTotal, totals.promoted, totals.suggested);
            });
    },
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

// ==================== SETTINGS ====================
// Behaviour settings shared across tabs.
// UI-only preferences (language, position, discreet mode, floating icon) stay local to each tab.
const SYNCED_SETTINGS_KEYS = [
    SETTINGS_KEYS.ENABLED,
    SETTINGS_KEYS.FILTER_PROMOTED,
    SETTINGS_KEYS.FILTER_SUGGESTED,
    SETTINGS_KEYS.FILTER_RECOMMENDED,
    SETTINGS_KEYS.LOGGING,
    SETTINGS_KEYS.VERBOSE_LOGGING,
];

/**
 * Apply a settings change to the in-memory state and its side effects.
 */
function applySettingsChange(next) {
    if (next[SETTINGS_KEYS.ENABLED] !== undefined) {
        const enabled = next[SETTINGS_KEYS.ENABLED];
        const wasEnabled = state.settings[SETTINGS_KEYS.ENABLED];
        state.settings[SETTINGS_KEYS.ENABLED] = enabled;

        if (!enabled) {
            if (wasEnabled) observer.stop();
        } else if (!wasEnabled && state.isCurrentlyScannable) {
            observer.start();
        }
    }

    for (const key of [
        SETTINGS_KEYS.FILTER_PROMOTED,
        SETTINGS_KEYS.FILTER_SUGGESTED,
        SETTINGS_KEYS.FILTER_RECOMMENDED,
    ]) {
        if (next[key] !== undefined) state.settings[key] = next[key];
    }

    if (next[SETTINGS_KEYS.LOGGING] !== undefined) {
        state.settings[SETTINGS_KEYS.LOGGING] = next[SETTINGS_KEYS.LOGGING];
        logger.setEnabled(next[SETTINGS_KEYS.LOGGING]);
    }
    if (next[SETTINGS_KEYS.VERBOSE_LOGGING] !== undefined) {
        state.settings[SETTINGS_KEYS.VERBOSE_LOGGING] = next[SETTINGS_KEYS.VERBOSE_LOGGING];
        logger.setVerbose(next[SETTINGS_KEYS.VERBOSE_LOGGING]);
    }

    state.ui?.updateSettings(next);
}

function setSetting(key, value) {
    setStored(key, value);
    applySettingsChange({ [key]: value });
}

// ==================== UI ====================
function initUI() {
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
            },
        },
        onToggleEnabled(enabled) {
            setSetting(SETTINGS_KEYS.ENABLED, enabled);
        },
        onToggleDiscreet(discreet) {
            state.settings[SETTINGS_KEYS.DISCREET] = discreet;
            setStored(SETTINGS_KEYS.DISCREET, discreet);
        },
        onTogglePromoted(enabled) {
            setSetting(SETTINGS_KEYS.FILTER_PROMOTED, enabled);
        },
        onToggleSuggested(enabled) {
            setSetting(SETTINGS_KEYS.FILTER_SUGGESTED, enabled);
        },
        onToggleRecommended(enabled) {
            setSetting(SETTINGS_KEYS.FILTER_RECOMMENDED, enabled);
        },
        onScan() {
            // Report what this scan blocked
            return scanFeed();
        },
        getCounters() {
            const totals = getTotalCounters();
            return {
                sessionTotal: state.sessionPromotedRemoved + state.sessionSuggestedRemoved,
                totalPromoted: totals.promoted,
                totalSuggested: totals.suggested,
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
            setSetting(SETTINGS_KEYS.LOGGING, enabled);
        },
        onToggleVerbose(enabled) {
            setSetting(SETTINGS_KEYS.VERBOSE_LOGGING, enabled);
        },
        onToggleHideFloatingUI(hidden) {
            state.settings[SETTINGS_KEYS.HIDE_FLOATING_UI] = hidden;
            setStored(SETTINGS_KEYS.HIDE_FLOATING_UI, hidden);
        },
        isFeedPage: () => isFeedPage(),
    });
}

// ==================== INIT ====================
// With @grant, Tampermonkey runs in a sandbox: use unsafeWindow to patch the page's real history
const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

function onVisibilityChange() {
    if (!state.isCurrentlyScannable) return;
    if (!state.settings[SETTINGS_KEYS.ENABLED]) return;
    if (document.hidden) observer.stop();
    else observer.start();
}

function handleUrlChange() {
    pageManager.handleUrlChange();
    if (state.ui) {
        if (isFeedPage()) state.ui.show();
        else state.ui.hide();
    }
}

const urlWatcher = createUrlWatcher({
    pageWindow,
    intervalMs: 1000,
    onChange: handleUrlChange,
});

function attachVisibilityListener() {
    document.addEventListener('visibilitychange', onVisibilityChange);
}

function detachVisibilityListener() {
    document.removeEventListener('visibilitychange', onVisibilityChange);
}

/**
 * `storage` events fire in the other tabs only: sync behaviour settings that
 * were changed from another LinkedIn tab.
 */
function onStorageChange(event) {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX)) return;

    const key = event.key.slice(STORAGE_PREFIX.length);
    if (!SYNCED_SETTINGS_KEYS.includes(key)) return;

    let value;
    try {
        value = JSON.parse(event.newValue);
    } catch {
        return;
    }
    if (typeof value !== 'boolean') return;

    applySettingsChange({ [key]: value });
}

function attachStorageListener() {
    pageWindow.removeEventListener('storage', onStorageChange);
    pageWindow.addEventListener('storage', onStorageChange);
}

function detachStorageListener() {
    pageWindow.removeEventListener('storage', onStorageChange);
}

function setRemoteDebugStatus(status) {
    const payload = {
        ...status,
        at: new Date().toISOString(),
    };

    try {
        localStorage.setItem('lsb_remote_status', JSON.stringify(payload));
    } catch {
        /* ignored */
    }

    try {
        pageWindow.__LinkedinSponsorBlockRemote = payload;
    } catch {
        /* ignored */
    }

    logger.info(`Remote status ${JSON.stringify(payload)}`);
}

// The userscript banner only grants GM_xmlhttpRequest and unsafeWindow, so the
// remote-config cache uses localStorage like every other userscript setting.
async function getUserscriptValue(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function setUserscriptValue(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        setRemoteDebugStatus({ phase: 'local-storage-set-failed', error: String(err) });
    }
}

function start() {
    // Verbose first: either toggle alone must keep logging active, and this avoids
    // the "logging is disabled" message when only detailed logging is enabled.
    logger.setVerbose(state.settings[SETTINGS_KEYS.VERBOSE_LOGGING]);
    logger.setEnabled(state.settings[SETTINGS_KEYS.LOGGING]);
    applyRemoteConfig(
        {
            async get(key) {
                return await getUserscriptValue(key);
            },
            async set(key, value) {
                await setUserscriptValue(key, value);
                setRemoteDebugStatus({ phase: 'stored', key });
            },
        },
        () =>
            new Promise((resolve, reject) => {
                const request =
                    (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest) ||
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest);

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
                    },
                });
            }),
    );
    if (state.ui) {
        state.ui.destroy();
        state.ui = null;
    }
    initUI();
    attachVisibilityListener();
    attachStorageListener();
    urlWatcher.start();
    state.isCurrentlyScannable = isScannablePage();
    if (state.isCurrentlyScannable && state.settings[SETTINGS_KEYS.ENABLED]) {
        observer.start();
    }
    if (!isFeedPage()) state.ui.hide();
}

function teardown() {
    if (state.waiter) {
        state.waiter.disconnect();
        state.waiter = null;
    }
    observer.stop();
    urlWatcher.stop();
    detachVisibilityListener();
    detachStorageListener();
    if (state.ui) {
        state.ui.destroy();
        state.ui = null;
    }
}

pageWindow.addEventListener('pagehide', teardown);
pageWindow.addEventListener('pageshow', (event) => {
    if (event.persisted) start();
});

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
