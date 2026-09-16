import { getUnscannedPosts, isPrimaryPostContainer, matchReason, scannedPosts } from './detection.js';
import { getActiveProfile } from './config.js';
import { logger } from './logger.js';
import { SETTINGS_KEYS } from './settings.js';

const LOG_PREVIEW_LENGTH = 100;

function getPostPreview(post, length = LOG_PREVIEW_LENGTH) {
    return post?.textContent?.replace(/\s+/g, ' ').trim().slice(0, length) ?? '';
}

/** Compact, human-readable description of why a post matched. */
function formatReason(reason) {
    if (!reason) return 'no-match';
    if (reason.kind === 'child-selector') return `child-selector ${reason.selector}`;
    return `${reason.kind} kw="${reason.keyword}" el="${reason.text}"`;
}

/** Why did this post match this category? (single source of truth: detection.js) */
function reasonFor(post, category) {
    return matchReason(post, getActiveProfile()?.detection?.[category]);
}

function hidePost(post, label, category, incrementCounter) {
    post.style.display = 'none';
    scannedPosts.add(post);
    incrementCounter();
    if (logger.verbose) {
        logger.log(
            `${label} post hidden [${formatReason(reasonFor(post, category))}]: "${getPostPreview(post)}"`,
        );
    } else {
        logger.log(`${label} post hidden: "${getPostPreview(post)}"`);
    }
}

export function createBlocker({ state, onBlocked } = {}) {
    if (!state) {
        throw new Error('createBlocker requires a state object');
    }

    function hidePromotedPost(post) {
        return hidePost(post, 'Promoted', 'sponsored', () => {
            state.sessionPromotedRemoved++;
        });
    }

    function hideSuggestedPost(post) {
        return hidePost(post, 'Suggested', 'suggested', () => {
            state.sessionSuggestedRemoved++;
        });
    }

    /**
     * Recommended posts intentionally share the suggested counter.
     * The UI presents both categories as non-promoted feed recommendations.
     */
    function hideRecommendedPost(post) {
        return hidePost(post, 'Recommended', 'recommended', () => {
            state.sessionSuggestedRemoved++;
        });
    }

    function scanFeed(root = document) {
        if (!state.settings[SETTINGS_KEYS.ENABLED]) {
            return { promoted: 0, suggested: 0 };
        }

        const groupedPosts = getUnscannedPosts(root);
        const scanned =
            groupedPosts.sponsored.length +
            groupedPosts.suggested.length +
            groupedPosts.recommended.length +
            groupedPosts.content.length;
        if (typeof state.sessionPostsScanned !== 'undefined') {
            state.sessionPostsScanned += scanned;
        }
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

        // Mark content (organic) posts as scanned so they aren't re-processed.
        // Maintainer debug mode also logs kept posts, answering
        // "why is this post NOT hidden?". Generic containers (nav bar, side rails, feed modules)
        // are still scanned for detection, but they are not posts, so they are not logged.
        const contentCount = groupedPosts.content.length;
        for (const post of groupedPosts.content) {
            scannedPosts.add(post);
            if (logger.verbose && isPrimaryPostContainer(post)) {
                logger.log(`Content post kept [no-match]: "${getPostPreview(post)}"`);
            }
        }

        if (scanned > 0) {
            onBlocked?.({ promoted: promotedCount, suggested: suggestedCount, scanned });
        }

        return {
            promoted: promotedCount,
            suggested: suggestedCount,
            scanned,
            content: contentCount,
        };
    }

    function resetSessionCounters() {
        state.sessionPromotedRemoved = 0;
        state.sessionSuggestedRemoved = 0;
        state.sessionPostsScanned = 0;
    }

    return {
        scanFeed,
        resetSessionCounters,
    };
}
