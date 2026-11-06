import { getActiveProfile, GENERIC_POST_CONTAINERS } from './config.js';
import { normalizeKeyword } from './keywords.js';

export const scannedPosts = new WeakSet();

/**
 * True when the container is a specific post wrapper, and not one of the generic LinkedIn markers
 * that also appear on the nav bar, the side rails or feed modules. Detection uses all containers,
 * this helper is only for reporting (detailed logs) so non-posts stay out of the output.
 */
export function isPrimaryPostContainer(post) {
    const containers = getActiveProfile()?.postContainers || [];
    return containers.some(
        (sel) => !GENERIC_POST_CONTAINERS.includes(sel) && post.matches?.(sel) === true,
    );
}

const REASON_TEXT_MAX = 120;

/**
 * Single source of truth for category matching. Returns a reason object when the
 * post matches `detection`, or null. Used by classification AND by the diagnostic
 * logs, so the two can never drift apart.
 *
 * reason.kind:
 *  - 'keyword-exact'     element text equals a keyword (e.g. "Post sponsorisé")
 *  - 'keyword-text-node' a direct text node equals a keyword (e.g. "Suivi par" + <a>)
 *  - 'keyword-substring' element text contains a keyword (e.g. "Followed by 2,415 people")
 *  - 'child-selector'    a structural selector matched (e.g. the author-row Follow button)
 */
export function matchReason(post, detection) {
    const { keywordSelectors = [], keywords, childSelectors = [] } = detection || {};
    const candidates = keywordSelectors.flatMap((sel) => Array.from(post.querySelectorAll(sel)));

    for (const el of candidates) {
        const rawText = el.textContent;
        const text = normalizeKeyword(rawText.trim());

        if (text.length === 0) continue;

        if (keywords.has(text)) {
            return {
                kind: 'keyword-exact',
                keyword: text,
                text: rawText.replace(/\s+/g, ' ').trim().slice(0, REASON_TEXT_MAX),
            };
        }

        for (const node of el.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE) continue;
            const directText = normalizeKeyword(node.textContent.trim());
            if (directText.length > 0 && keywords.has(directText)) {
                return {
                    kind: 'keyword-text-node',
                    keyword: directText,
                    text: rawText.replace(/\s+/g, ' ').trim().slice(0, REASON_TEXT_MAX),
                };
            }
        }

        for (const kw of keywords) {
            if (text.includes(kw)) {
                return {
                    kind: 'keyword-substring',
                    keyword: kw,
                    text: rawText.replace(/\s+/g, ' ').trim().slice(0, REASON_TEXT_MAX),
                };
            }
        }
    }

    for (const sel of childSelectors) {
        if (post.querySelector(sel)) {
            return { kind: 'child-selector', selector: sel };
        }
    }

    return null;
}

function matchesByKeyword(post, detection) {
    return matchReason(post, detection) !== null;
}

function isSponsored(post, profile) {
    return matchesByKeyword(post, profile.detection.sponsored);
}
function isSuggested(post, profile) {
    return matchesByKeyword(post, profile.detection.suggested);
}
function isRecommended(post, profile) {
    return matchesByKeyword(post, profile.detection.recommended);
}

function hasMatchingAncestor(post, matched) {
    let node = post.parentElement;
    while (node) {
        if (matched.has(node)) return true;
        node = node.parentElement;
    }
    return false;
}

/**
 * Collect post containers from one root or a batch of newly added elements.
 * For an element added inside an existing post (e.g. the sponsored label), the
 * closest post container is used so the whole post is re-evaluated instead of
 * just the new fragment.
 */
function collectPostCandidates(roots, selector) {
    const candidates = new Set();

    for (const root of roots) {
        if (!root) continue;

        if (root.nodeType === Node.ELEMENT_NODE) {
            const container = root.closest(selector);
            if (container) candidates.add(container);
        }

        if (typeof root.querySelectorAll === 'function') {
            for (const el of root.querySelectorAll(selector)) candidates.add(el);
        }
    }

    return candidates;
}

export function getUnscannedPosts(root) {
    const roots = Array.isArray(root) ? root : [root];
    const profile = getActiveProfile();
    const selector = profile.postContainers.join(',');
    const matched = collectPostCandidates(roots, selector);

    // Keep the ones with no matching ancestor and drop already-scanned posts in the same pass
    const posts = [...matched].filter(
        (post) => !scannedPosts.has(post) && !hasMatchingAncestor(post, matched),
    );

    const groups = {
        sponsored: [],
        suggested: [],
        recommended: [],
        content: [],
    };

    posts.forEach((post) => {
        if (isSponsored(post, profile)) {
            groups.sponsored.push(post);
        } else if (isSuggested(post, profile)) {
            groups.suggested.push(post);
        } else if (isRecommended(post, profile)) {
            groups.recommended.push(post);
        } else {
            groups.content.push(post);
        }
    });

    return groups;
}
