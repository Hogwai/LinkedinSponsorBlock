/**
 * Settings keys and default values shared between extension and userscript
 */

export const SETTINGS_KEYS = {
    ENABLED: 'enabled',
    DISCREET: 'discreet',
    FILTER_PROMOTED: 'filterPromoted',
    FILTER_SUGGESTED: 'filterSuggested',
    LANGUAGE: 'language',
    POSITION: 'position',
    TOTAL_PROMOTED_BLOCKED: 'totalPromotedBlocked',
    TOTAL_SUGGESTED_BLOCKED: 'totalSuggestedBlocked'
};

export const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.ENABLED]: true,
    [SETTINGS_KEYS.DISCREET]: false,
    [SETTINGS_KEYS.FILTER_PROMOTED]: true,
    [SETTINGS_KEYS.FILTER_SUGGESTED]: true,
    [SETTINGS_KEYS.LANGUAGE]: 'en',
    [SETTINGS_KEYS.POSITION]: 'br',
    [SETTINGS_KEYS.TOTAL_PROMOTED_BLOCKED]: 0,
    [SETTINGS_KEYS.TOTAL_SUGGESTED_BLOCKED]: 0
};

export const LANGUAGES = ['en', 'fr'];

export const POSITIONS = {
    BOTTOM_RIGHT: 'br',
    BOTTOM_LEFT: 'bl',
    TOP_RIGHT: 'tr',
    TOP_LEFT: 'tl'
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
