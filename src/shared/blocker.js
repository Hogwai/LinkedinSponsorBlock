import { getUnscannedPosts, scannedPosts } from './detection.js';
import { logger } from './logger.js';
import { SETTINGS_KEYS } from './settings.js';

const HIDDEN_POST_TEXT_LENGTH = 100;

function getPostPreview(post) {
    return post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, HIDDEN_POST_TEXT_LENGTH);
}

function hidePost(post, label, incrementCounter) {
    post.style.display = 'none';
    scannedPosts.add(post);
    incrementCounter();
    logger.log(`${label} post hidden: "${getPostPreview(post)}"`);
}

export function createBlocker({ state, onBlocked } = {}) {
    if (!state) {
        throw new Error('createBlocker requires a state object');
    }

    function hidePromotedPost(post) {
        return hidePost(post, 'Promoted', () => {
            state.sessionPromotedRemoved++;
        });
    }

    function hideSuggestedPost(post) {
        return hidePost(post, 'Suggested', () => {
            state.sessionSuggestedRemoved++;
        });
    }

    /**
     * Recommended posts intentionally share the suggested counter.
     * The UI presents both categories as non-promoted feed recommendations.
     */
    function hideRecommendedPost(post) {
        return hidePost(post, 'Recommended', () => {
            state.sessionSuggestedRemoved++;
        });
    }

    function scanFeed(root = document) {
        if (!state.settings[SETTINGS_KEYS.ENABLED]) {
            return { promoted: 0, suggested: 0 };
        }

        const groupedPosts = getUnscannedPosts(root);
        let promotedCount = 0;
        let suggestedCount = 0;

        if (state.settings[SETTINGS_KEYS.FILTER_PROMOTED]) {
            for (const post of groupedPosts.sponsored) {
                hidePromotedPost(post);
                promotedCount += 1;
            }
        }

        if (state.settings[SETTINGS_KEYS.FILTER_SUGGESTED]) {
            for (const post of groupedPosts.suggested) {
                hideSuggestedPost(post);
                suggestedCount += 1;
            }
        }

        if (state.settings[SETTINGS_KEYS.FILTER_RECOMMENDED]) {
            for (const post of groupedPosts.recommended) {
                hideRecommendedPost(post);
                suggestedCount += 1;
            }
        }

        if (promotedCount > 0 || suggestedCount > 0) {
            onBlocked?.({ promoted: promotedCount, suggested: suggestedCount });
        }

        return { promoted: promotedCount, suggested: suggestedCount };
    }

    function resetSessionCounters() {
        state.sessionPromotedRemoved = 0;
        state.sessionSuggestedRemoved = 0;
    }

    return {
        scanFeed,
        resetSessionCounters
    };
}
