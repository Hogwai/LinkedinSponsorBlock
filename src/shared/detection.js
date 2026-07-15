import { getActiveProfile } from './config.js';
import { normalizeKeyword } from './keywords.js';

export const scannedPosts = new WeakSet();

function matchesByKeyword(post, detection) {
    const { keywordSelectors, keywords, childSelectors } = detection;
    const candidates = keywordSelectors.flatMap((sel) => Array.from(post.querySelectorAll(sel)));
    if (
        candidates.some((el) => {
            const text = normalizeKeyword(el.textContent.trim());
            if (keywords.has(text)) return true;

            // Fallback: check direct text nodes (handles "Sponsorisé par <a>Company</a>")
            const directText = Array.from(el.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => normalizeKeyword(n.textContent.trim()))
                .filter((t) => t.length > 0);
            if (directText.some((t) => keywords.has(t))) return true;
            
            // Secondary fallback: check if element text contains any keyword as substring
            for (const kw of keywords) {
                if (text.includes(kw)) return true;
            }
            return false;
        })
    ) {
        return true;
    }
    return childSelectors.some((sel) => post.querySelector(sel));
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
