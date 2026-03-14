import { CONFIG } from './config.js';

function matchesByKeyword(post, detection) {
    const { keywordMatch, childSelectors } = detection;
    const candidates = post.querySelectorAll(keywordMatch.selector);
    const keywords = keywordMatch.keywords;
    if (Array.from(candidates).some(el => {
        const text = el.textContent.trim().toLowerCase();
        return keywords.has(text) || Array.from(keywords).some(kw => text.includes(kw));
    })) {
        return true;
    }
    return childSelectors.some(sel => post.querySelector(sel));
}

function isSponsored(post) { return matchesByKeyword(post, CONFIG.DETECTION.SPONSORED); }
function isSuggested(post) { return matchesByKeyword(post, CONFIG.DETECTION.SUGGESTED); }
function isRecommended(post) { return matchesByKeyword(post, CONFIG.DETECTION.RECOMMENDED); }

export function getUnscannedPosts(root) {
    const selector = CONFIG.SELECTORS.POST_CONTAINERS
        .map(s => `${s}:not([${CONFIG.ATTRIBUTES.SCANNED}])`)
        .join(',');
    let posts = [];
    if (root.matches?.(selector)) {
        posts.push(root);
    }
    posts.push(...root.querySelectorAll(selector));

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
