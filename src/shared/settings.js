/**
 * Settings keys and default values shared between extension and userscript
 */

export const SETTINGS_KEYS = {
    ENABLED: 'enabled',
    DISCREET: 'discreet',
    FILTER_PROMOTED: 'filterPromoted',
    FILTER_SUGGESTED: 'filterSuggested',
    FILTER_RECOMMENDED: 'filterRecommended',
    LANGUAGE: 'language',
    POSITION: 'position',
    TOTAL_PROMOTED_BLOCKED: 'totalPromotedBlocked',
    TOTAL_SUGGESTED_BLOCKED: 'totalSuggestedBlocked',
    TOTAL_POSTS_SCANNED: 'totalPostsScanned',
    INSTALL_DATE: 'installDate',
    REVIEW_BANNER_DISMISSED: 'reviewBannerDismissed',
    LOGGING: 'logging',
    HIDE_FLOATING_UI: 'hideFloatingUI',
};

export const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.ENABLED]: true,
    [SETTINGS_KEYS.DISCREET]: false,
    [SETTINGS_KEYS.FILTER_PROMOTED]: true,
    [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
    [SETTINGS_KEYS.FILTER_RECOMMENDED]: true,
    [SETTINGS_KEYS.LANGUAGE]: 'en',
    [SETTINGS_KEYS.POSITION]: 'br',
    [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
    [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0,
    [SETTINGS_KEYS.TOTAL_POSTS_SCANNED]: 0,
    [SETTINGS_KEYS.INSTALL_DATE]: 0,
    [SETTINGS_KEYS.REVIEW_BANNER_DISMISSED]: false,
    [SETTINGS_KEYS.LOGGING]: false,
    [SETTINGS_KEYS.HIDE_FLOATING_UI]: false,
};

/**
 * Extension-owned storage keys, in order. Excludes userscript-only
 * (HIDE_FLOATING_UI) and UI-only (DISCREET, POSITION) keys so the popup
 * never writes or queries them.
 */
const extensionStorageKeys = [
    SETTINGS_KEYS.ENABLED,
    SETTINGS_KEYS.FILTER_PROMOTED,
    SETTINGS_KEYS.FILTER_SUGGESTED,
    SETTINGS_KEYS.FILTER_RECOMMENDED,
    SETTINGS_KEYS.LANGUAGE,
    SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED,
    SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED,
    SETTINGS_KEYS.TOTAL_POSTS_SCANNED,
    SETTINGS_KEYS.INSTALL_DATE,
    SETTINGS_KEYS.REVIEW_BANNER_DISMISSED,
    SETTINGS_KEYS.LOGGING,
];

/**
 * Defaults for extension-owned storage keys only. Values are derived from the
 * canonical DEFAULT_SETTINGS so they can never drift out of sync.
 */
export const EXTENSION_STORAGE_DEFAULTS = Object.fromEntries(
    extensionStorageKeys.map((key) => [key, DEFAULT_SETTINGS[key]]),
);

export const LANGUAGES = ['en', 'fr', 'es', 'pt', 'de', 'it', 'hi', 'ar', 'zh', 'ja'];

export function detectLanguage() {
    const locale = (navigator.language || 'en').toLowerCase().split('-')[0];
    return LANGUAGES.includes(locale) ? locale : 'en';
}

export const POSITIONS = {
    BOTTOM_RIGHT: 'br',
    BOTTOM_LEFT: 'bl',
    TOP_RIGHT: 'tr',
    TOP_LEFT: 'tl',
};

/**
 * Get a setting value from a settings object, with fallback to default
 */
export function getSetting(settings, key) {
    return settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
}

/**
 * Merge partial settings with defaults
 */
export function mergeSettings(partialSettings) {
    return { ...DEFAULT_SETTINGS, ...partialSettings };
}
