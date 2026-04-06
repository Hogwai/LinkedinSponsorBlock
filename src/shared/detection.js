import { CONFIG } from './config.js';

export const scannedPosts = new WeakSet();

function matchesByKeyword(post, detection) {
    const { keywordMatch, childSelectors } = detection;
    const candidates = keywordMatch.selectors.flatMap(sel =>
        Array.from(post.querySelectorAll(sel))
    );
    if (candidates.some(el => {
        const text = el.textContent.trim().toLowerCase();
        if (keywordMatch.keywords.has(text)) return true;
        // Fallback: check direct text nodes (handles "Sponsorisé par <a>Company</a>")
        const directText = Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent.trim().toLowerCase())
            .filter(t => t.length > 0);
        return directText.some(t => keywordMatch.keywords.has(t));
    })) {
        return true;
    }
    return childSelectors.some(sel => post.querySelector(sel));
}

function isSponsored(post) { return matchesByKeyword(post, CONFIG.DETECTION.SPONSORED); }
function isSuggested(post) { return matchesByKeyword(post, CONFIG.DETECTION.SUGGESTED); }
function isRecommended(post) { return matchesByKeyword(post, CONFIG.DETECTION.RECOMMENDED); }

export function getUnscannedPosts(root) {
    const selector = CONFIG.SELECTORS.POST_CONTAINERS.join(',');
    let posts = [];
    if (root.matches?.(selector)) {
        posts.push(root);
    }
    posts.push(...root.querySelectorAll(selector));
    posts = posts.filter(post => !scannedPosts.has(post));

    // Only first level elements (posts)
    posts = posts.filter(post => !post.parentElement?.closest(CONFIG.SELECTORS.POST_CONTAINERS.join(',')));

    const groups = {
        sponsored: [],
        suggested: [],
        recommended: [],
        content: [],
    };

    posts.forEach(post => {
        if (isSponsored(post)) {
            groups.sponsored.push(post);
        } else if (isSuggested(post)) {
            groups.suggested.push(post);
        } else if (isRecommended(post)) {
            groups.recommended.push(post);
        }
    });

    return groups;
}
