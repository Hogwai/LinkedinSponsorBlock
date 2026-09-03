/**
 * Multi-language keyword sets for detecting sponsored/suggested/recommended posts.
 * Each keyword is lowercased and NFC-normalized. These are the embedded defaults;
 * remote config overrides may supplement or replace them at runtime.
 */

import sponsored from '../../keywords/sponsored.json' with { type: 'json' };
import suggested from '../../keywords/suggested.json' with { type: 'json' };
import recommended from '../../keywords/recommended.json' with { type: 'json' };

/**
 * Normalize text for keyword matching: lowercase + NFC (handles Unicode
 * composed/decomposed differences across scripts like Gurmukhi, Devanagari)
 * Strip invisible formatting characters (RLM, LRM, ZWJ, ZWNJ, etc.)
 * that LinkedIn inserts into right-to-left text.
 */
export function normalizeKeyword(text) {
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]+/g, '');
}

function flatten(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return Object.values(data).flat();
    return [];
}

export const SHARED_KEYWORDS = {
    sponsored: new Set(flatten(sponsored).map(normalizeKeyword)),
    suggested: new Set(flatten(suggested).map(normalizeKeyword)),
    recommended: new Set(flatten(recommended).map(normalizeKeyword)),
};
