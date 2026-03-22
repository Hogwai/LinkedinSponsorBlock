import { CONFIG } from './config.js';
import { logger } from './logger.js';

const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/Hogwai/LinkedinSponsorBlock/main/remote-config.json';
const STORAGE_KEY = 'lsb_remote_config';
const SUPPORTED_VERSION = 2;
const CATEGORIES = ['sponsored', 'suggested', 'recommended'];

// Module-level state for deferred merge
let storedRemoteConfig = null;
let activeProfileName = null;

function isNonEmptyString(v) {
    return typeof v === 'string' && v.length > 0;
}

function isArrayOfStrings(v, allowEmpty = false) {
    return Array.isArray(v) && (allowEmpty || v.length > 0) && v.every(item => typeof item === 'string');
}

function isValidSelector(s) {
    try { document.querySelector(s); return true; } catch { return false; }
}

function isValidFeedWrapperValue(v) {
    return v === null || (isNonEmptyString(v) && isValidSelector(v));
}

function isValidProfile(profile) {
    if (!profile) return false;

    const fw = profile.feedWrapper;
    if (!fw) return false;
    if (!isValidFeedWrapperValue(fw.mobile)) return false;
    if (!isValidFeedWrapperValue(fw.desktop)) return false;
    if (!isValidFeedWrapperValue(fw.newFeed)) return false;

    if (!isArrayOfStrings(profile.postContainers)) return false;
    if (!profile.postContainers.every(isValidSelector)) return false;

    const det = profile.detection;
    if (!det) return false;

    for (const cat of CATEGORIES) {
        const entry = det[cat];
        if (!entry) return false;
        if (!isArrayOfStrings(entry.keywordSelectors)) return false;
        if (!entry.keywordSelectors.every(isValidSelector)) return false;
        if (!isArrayOfStrings(entry.keywords)) return false;
        if (!isArrayOfStrings(entry.childSelectors, true)) return false;
        if (!entry.childSelectors.every(isValidSelector)) return false;
    }

    return true;
}

function isValid(config) {
    if (!config || config.version !== SUPPORTED_VERSION) return false;
    if (!config.profiles || typeof config.profiles !== 'object') return false;

    for (const key of Object.keys(config.profiles)) {
        if (!isValidProfile(config.profiles[key])) return false;
    }

    return Object.keys(config.profiles).length > 0;
}

function mergeProfile(remote, profileName) {
    const profile = remote.profiles[profileName];
    if (!profile) return;

    CONFIG.SELECTORS.POST_CONTAINERS = profile.postContainers;
    CONFIG.SELECTORS.FEED_WRAPPER = {
        mobile: profile.feedWrapper.mobile,
        desktop: profile.feedWrapper.desktop,
        newFeed: profile.feedWrapper.newFeed
    };

    for (const cat of CATEGORIES) {
        const src = profile.detection[cat];
        const dest = CONFIG.DETECTION[cat.toUpperCase()];
        dest.keywordMatch.selectors = src.keywordSelectors;
        dest.keywordMatch.keywords = new Set(src.keywords);
        dest.childSelectors = src.childSelectors;
    }
}

export function applyRemoteOverrides(profileName) {
    activeProfileName = profileName;
    if (storedRemoteConfig && isValid(storedRemoteConfig)) {
        mergeProfile(storedRemoteConfig, profileName);
        logger.info(`Remote config applied for profile: ${profileName}`);
    }
}

async function fetchRemoteConfig(storage, fetcher) {
    try {
        const remote = await fetcher();
        if (!remote || !isValid(remote)) return;
        storedRemoteConfig = remote;
        if (activeProfileName) {
            mergeProfile(remote, activeProfileName);
        }
        await storage.set(STORAGE_KEY, remote);
        logger.info('Remote config fetched and applied');
    } catch {
        // Network error, parse error, or storage error — silent fallback
    }
}

export async function fetchRemoteConfigJSON() {
    const response = await fetch(REMOTE_CONFIG_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json();
}

export async function applyRemoteConfig(storage, fetcher) {
    // Phase 1: load cached config into memory (do NOT merge — layout not detected yet)
    try {
        const cached = await storage.get(STORAGE_KEY);
        if (isValid(cached)) {
            storedRemoteConfig = cached;
        }
    } catch {
        // Cache read failed — continue with embedded config
    }

    // Phase 2: fetch fresh config in background (fire-and-forget)
    fetchRemoteConfig(storage, fetcher);
}
