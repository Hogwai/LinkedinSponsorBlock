import { CONFIG } from './config.js';

//const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/Hogwai/LinkedinSponsorBlock/main/remote-config.json';
const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/Hogwai/LinkedinSponsorBlock/refs/heads/feature/remote_config/remote-config.json';
const STORAGE_KEY = 'lsb_remote_config';
const SUPPORTED_VERSION = 1;
const CATEGORIES = ['sponsored', 'suggested', 'recommended'];

function isNonEmptyString(v) {
    return typeof v === 'string' && v.length > 0;
}

function isArrayOfStrings(v, allowEmpty = false) {
    return Array.isArray(v) && (allowEmpty || v.length > 0) && v.every(item => typeof item === 'string');
}

function isValidSelector(s) {
    try { document.querySelector(s); return true; } catch { return false; }
}

function isValid(config) {
    if (!config || config.version !== SUPPORTED_VERSION) return false;

    const sel = config.selectors;
    if (!sel) return false;
    if (!isArrayOfStrings(sel.postContainers)) return false;
    if (!sel.postContainers.every(isValidSelector)) return false;

    const fw = sel.feedWrapper;
    if (!fw || !isNonEmptyString(fw.mobile) || !isNonEmptyString(fw.desktop) || !isNonEmptyString(fw.newFeed)) return false;
    if (!isValidSelector(fw.mobile) || !isValidSelector(fw.desktop) || !isValidSelector(fw.newFeed)) return false;

    const det = config.detection;
    if (!det) return false;

    for (const cat of CATEGORIES) {
        const entry = det[cat];
        if (!entry) return false;
        if (!entry.keywordMatch || !isNonEmptyString(entry.keywordMatch.selector) || !isValidSelector(entry.keywordMatch.selector)) return false;
        if (!isArrayOfStrings(entry.keywordMatch.keywords)) return false;
        if (!isArrayOfStrings(entry.childSelectors, true)) return false;
        if (!entry.childSelectors.every(isValidSelector)) return false;
    }

    return true;
}

function mergeConfig(remote) {
    CONFIG.SELECTORS.POST_CONTAINERS = remote.selectors.postContainers;
    CONFIG.SELECTORS.FEED_WRAPPER = remote.selectors.feedWrapper;

    for (const cat of CATEGORIES) {
        const src = remote.detection[cat];
        const dest = CONFIG.DETECTION[cat.toUpperCase()];
        dest.keywordMatch.selector = src.keywordMatch.selector;
        dest.keywordMatch.keywords = new Set(src.keywordMatch.keywords);
        dest.childSelectors = src.childSelectors;
    }
}

async function fetchRemoteConfig(storage, fetcher) {
    try {
        const remote = await fetcher();
        if (!remote || !isValid(remote)) return;
        mergeConfig(remote);
        await storage.set(STORAGE_KEY, remote);
        console.log('[LinkedinSponsorBlock] Remote config applied');
    } catch {
        // Network error, parse error, or storage error — silent fallback
    }
}

/**
 * Fetch remote config JSON. Used by background script (extension) or directly (userscript).
 */
export async function fetchRemoteConfigJSON() {
    const response = await fetch(REMOTE_CONFIG_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json();
}

/**
 * Apply remote config: reads cached config (awaited), then fetches fresh config in background.
 * @param {object} storage - { get(key): Promise<object|null>, set(key, value): Promise<void> }
 * @param {function} fetcher - async function that returns the remote config object or null
 */
export async function applyRemoteConfig(storage, fetcher) {
    // Phase 1: apply cached config
    try {
        const cached = await storage.get(STORAGE_KEY);
        if (isValid(cached)) {
            mergeConfig(cached);
        }
    } catch {
        // Cache read failed — continue with embedded config
    }

    // Phase 2: fetch fresh config in background (fire-and-forget)
    fetchRemoteConfig(storage, fetcher);
}
