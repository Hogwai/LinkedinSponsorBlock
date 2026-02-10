import { CONFIG } from './config.js';

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
        content: [],
    };

    posts.forEach(post => {
        const lowerAttr = post.getAttribute('data-view-tracking-scope')?.toLowerCase();

        if (CONFIG.SPONSORED_PATTERNS.some(p => lowerAttr.includes(p.toLowerCase()))) {
            groups.sponsored.push(post);
            return;
        }

        const candidateContainers = post.querySelectorAll('p[componentkey]');
        const isSuggested = Array.from(candidateContainers).find(p => {
            const label = p.textContent.trim().toLowerCase();
            return CONFIG.SUGGESTION_KEYWORDS.has(label);
        });

        if (isSuggested) {
            groups.suggested.push(post);
        }
    });

    return groups;
}
