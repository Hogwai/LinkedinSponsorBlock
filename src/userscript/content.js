import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { getUnscannedPosts } from '../shared/detection.js';
import { createObserver } from '../shared/observer.js';
import { isFeedPage, createPageManager } from '../shared/page.js';

// ==================== STATE ====================
const state = {
    observer: null,
    waiter: null,
    sessionRemoved: 0,
    isObserverConnected: false,
    isCurrentlyFeedPage: false
};

// ==================== NOTIFIER ====================
const notifier = {
    pending: false,
    scheduled: false,
    queue() {
        this.pending = true;
        if (!this.scheduled) {
            this.scheduled = true;
            setTimeout(() => {
                requestIdleCallback(() => {
                    if (this.pending) {
                        // Userscript has no background page to notify,
                        // but keep the structure for consistency
                        this.pending = false;
                    }
                    this.scheduled = false;
                }, { timeout: 500 });
            }, CONFIG.DELAYS.NOTIFICATION);
        }
    }
};

// ==================== HIDE FUNCTIONS ====================
function hideSuggestedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionRemoved++;
    logger.log(`Suggested post hidden: "${post?.textContent?.trim().slice(0, 100)}"`);
    return true;
}

function hidePromotedPost(post) {
    post.style.display = 'none';
    post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
    state.sessionRemoved++;
    logger.log(`Promoted post hidden: "${post?.textContent?.trim().slice(0, 100)}"`);
    return true;
}

// ==================== SCAN ====================
function scanFeed(root = document) {
    const groupedPosts = getUnscannedPosts(root);
    let count = 0;

    for (const post of groupedPosts.sponsored) {
        if (hidePromotedPost(post)) {
            count += 1;
        } else {
            post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
        }
    }

    for (const post of groupedPosts.suggested) {
        if (hideSuggestedPost(post)) {
            count += 1;
        } else {
            post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
        }
    }

    if (count > 0) {
        notifier.queue();
    }
    return count;
}

// ==================== OBSERVER & PAGE ====================
const observer = createObserver(scanFeed, state);

const pageManager = createPageManager(state, observer, () => {
    state.sessionRemoved = 0;
});

// ==================== INIT ====================
document.addEventListener('visibilitychange', () => {
    if (!state.isCurrentlyFeedPage) return;
    document.hidden ? observer.stop() : observer.start();
});

// URL polling (no background script in userscript)
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        pageManager.handleUrlChange();
    }
}, 500);

state.isCurrentlyFeedPage = isFeedPage();

if (document.body) {
    if (state.isCurrentlyFeedPage) observer.start();
} else {
    state.waiter = new MutationObserver(() => {
        if (document.body) {
            state.waiter.disconnect();
            state.waiter = null;
            if (state.isCurrentlyFeedPage) observer.start();
        }
    });
    state.waiter.observe(document.documentElement, { childList: true });
}
