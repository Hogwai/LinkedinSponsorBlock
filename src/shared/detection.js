import { CONFIG } from './config.js';

function isSponsored(post) {
    const { attributeMatch, childSelectors } = CONFIG.DETECTION.SPONSORED;
    const attrValue = post.getAttribute(attributeMatch.attr)?.toLowerCase();
    if (attrValue && attributeMatch.patterns.some(p => attrValue.includes(p.toLowerCase()))) {
        return true;
    }
    return childSelectors.some(sel => post.querySelector(sel));
}

function isSuggested(post) {
    const { keywordMatch, childSelectors } = CONFIG.DETECTION.SUGGESTED;
    const candidates = post.querySelectorAll(keywordMatch.selector);
    if (Array.from(candidates).some(el => keywordMatch.keywords.has(el.textContent.trim().toLowerCase()))) {
        return true;
    }
    return childSelectors.some(sel => post.querySelector(sel));
}

function isRecommended(post) {
    const { keywordMatch, childSelectors } = CONFIG.DETECTION.RECOMMENDED;
    const candidates = post.querySelectorAll(keywordMatch.selector);
    if (Array.from(candidates).some(el => keywordMatch.keywords.has(el.textContent.trim().toLowerCase()))) {
        return true;
    }
    return childSelectors.some(sel => post.querySelector(sel));
}

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
