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
        const text = normalizeKeyword(el.textContent.trim());
        const snippet = el.textContent.replace(/\s+/g, ' ').trim().slice(0, REASON_TEXT_MAX);

        if (keywords.has(text)) {
            return { kind: 'keyword-exact', keyword: text, text: snippet };
        }

        const directText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => normalizeKeyword(n.textContent.trim()))
            .filter((t) => t.length > 0);
        const directHit = directText.find((t) => keywords.has(t));
        if (directHit) {
            return { kind: 'keyword-text-node', keyword: directHit, text: snippet };
        }

        for (const kw of keywords) {
            if (text.includes(kw)) {
                return { kind: 'keyword-substring', keyword: kw, text: snippet };
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

export function getUnscannedPosts(root) {
    const profile = getActiveProfile();
    const selector = profile.postContainers.join(',');
    let posts = [];
    if (root.matches?.(selector)) {
        posts.push(root);
    }
    posts.push(...root.querySelectorAll(selector));
    posts = posts.filter((post) => !scannedPosts.has(post));

    // Only first level elements (posts)
    posts = posts.filter((post) => !post.parentElement?.closest(selector));

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
