(function () {
    'use strict';

    // ==================== ENVIRONNEMENT ====================
    const ENV = {
        isFirefoxExtension: typeof browser !== 'undefined' && !!browser.runtime?.id,
        isChromeExtension: typeof chrome !== 'undefined' && !!chrome.runtime?.id,
        isUserscript: typeof GM_info !== 'undefined'
    };

    // ==================== ABSTRACTION API ====================
    const runtime = {
        sendMessage(message) {
            if (ENV.isFirefoxExtension) {
                return browser.runtime.sendMessage(message).catch(() => { });
            }
            if (ENV.isChromeExtension) {
                return chrome.runtime.sendMessage(message).catch(() => { });
            }
            return Promise.resolve();
        },

        onMessage(callback) {
            if (ENV.isFirefoxExtension) {
                browser.runtime.onMessage.addListener(callback);
            }
            if (ENV.isChromeExtension) {
                chrome.runtime.onMessage.addListener(callback);
            }

        }
    };

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        ATTRIBUTES: {
            SCANNED: 'data-sponsor-scanned'
        },
        DELAYS: {
            OBSERVER_RETRY: 200,
            NOTIFICATION: 300
        },
        SELECTORS: {
            POST_CONTAINERS: [
                '.ember-view.occludable-update',
                '[class*="ember-view"][class*="occludable-update"]',
                'div[class*="feed-shared-update-v2"][id*="ember"]',
                'article[data-id="main-feed-card"]',
                'div[data-view-tracking-scope*=\'transporterKeys":["sponsored"]\']',
                'div[data-view-tracking-scope*=\'transporterKeys":["default"]\']'
            ],
            FEED_WRAPPER: {
                mobile: 'ol.feed-container',
                desktop: '[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]',
                newFeed: '[data-testid="mainFeed"]'
            }
        },
        SPONSORED_PATTERNS: [
            'sponsored',
            'SponsoredUpdateServed',
            'SPONSORED_UPDATE_SERVED',
            '["sponsored"]'
        ],
        SUGGESTION_KEYWORDS: new Set([
            'Suggestions', // FRENCH
            'Suggested',  // ENGLISH
            'Vorgeschlagen',  // GERMAN
            'Sugerencias', // SPANISH
        ].map(t => t.toLowerCase())),
    };

    // ==================== STATE & UTILS ====================
    const state = {
        observer: null,
        waiter: null,
        sessionRemoved: 0,
        isObserverConnected: false,
        isCurrentlyFeedPage: false
    };

    const logger = {
        buffer: [],
        scheduled: false,
        log(message) {
            this.buffer.push(message);
            if (!this.scheduled) {
                this.scheduled = true;
                requestIdleCallback(() => {
                    console.groupCollapsed(`[LinkedinSponsorBlock] ${this.buffer.length} hidden`);
                    this.buffer.forEach(msg => console.debug(msg));
                    console.groupEnd();
                    this.buffer = [];
                    this.scheduled = false;
                }, { timeout: 1000 });
            }
        }
    };

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
                            runtime.sendMessage({
                                type: "BLOCKED",
                                count: state.sessionRemoved
                            });
                            this.pending = false;
                        }
                        this.scheduled = false;
                    }, { timeout: 500 });
                }, CONFIG.DELAYS.NOTIFICATION);
            }
        }
    };

    // ==================== CORE LOGIC ====================
    const dom = {
        hideSuggestedPost(suggestedPost) {
            suggestedPost.style.display = 'none';
            suggestedPost.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
            state.sessionRemoved++;
            logger.log(`Suggested post hidden: "${suggestedPost?.textContent?.trim().slice(0, 100)}"`);
            return true;
        },
        hidePromotedPost(promotedPost) {
            promotedPost.style.display = 'none';
            promotedPost.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'true');
            state.sessionRemoved++;
            logger.log(`Promoted post hidden: "${promotedPost?.textContent?.trim().slice(0, 100)}"`);
            return true;
        },
        getUnscannedPosts(root) {
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
                    groups['sponsored'].push(post);
                    return;
                }

                const candidateContainers = post.querySelectorAll('p[componentkey]');
                const isSuggested = Array.from(candidateContainers).find(p => {
                    const label = p.textContent.trim().toLowerCase();
                    return CONFIG.SUGGESTION_KEYWORDS.has(label);
                });

                if (isSuggested) {
                    groups['suggested'].push(post);
                }
            });

            return groups;
        }
    };

    function scanFeed(root = document) {
        const groupedPosts = dom.getUnscannedPosts(root);
        let count = 0;
        for (const post of groupedPosts.sponsored) {
            if (dom.hidePromotedPost(post)) {
                count += 1;
            } else {
                post.setAttribute(CONFIG.ATTRIBUTES.SCANNED, 'false');
            }
        }

        for (const post of groupedPosts.suggested) {
            if (dom.hideSuggestedPost(post)) {
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


    // ==================== OBSERVER ====================
    function startObserver() {
        if (state.isObserverConnected) return;

        const { FEED_WRAPPER } = CONFIG.SELECTORS;
        const feed = document.querySelector(FEED_WRAPPER.newFeed) ||
            document.querySelector(FEED_WRAPPER.mobile);

        if (!feed) {
            setTimeout(startObserver, CONFIG.DELAYS.OBSERVER_RETRY);
            return;
        }
        console.debug('Feed detected');

        let debounceTimeout = null;

        state.observer = new MutationObserver(mutations => {
            let hasNewElement = false;

            for (const m of mutations) {
                for (const node of m.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        hasNewElement = true;
                        break;
                    }
                }
                if (hasNewElement) break;
            }

            if (!hasNewElement) return;

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                scanFeed(feed);
            }, CONFIG.DELAYS.OBSERVER_RETRY);
        });

        scanFeed(feed);

        state.observer.observe(feed, {
            childList: true,
            subtree: true
        });

        state.isObserverConnected = true;
    }

    function stopObserver() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
            state.isObserverConnected = false;
        }
    }

    // ==================== PAGE MANAGEMENT ====================
    function isFeedPage() {
        const path = location.pathname;
        return path.startsWith('/feed') || path.startsWith('/preload');
    }

    function handleUrlChange() {
        const wasFeedPage = state.isCurrentlyFeedPage;
        state.isCurrentlyFeedPage = isFeedPage();
        if (state.isCurrentlyFeedPage === wasFeedPage) return;
        stopObserver();
        if (state.isCurrentlyFeedPage) {
            state.sessionRemoved = 0;
            startObserver();
        }
    }

    // ==================== INIT ====================
    document.addEventListener('visibilitychange', () => {
        if (!state.isCurrentlyFeedPage) return;
        document.hidden ? stopObserver() : startObserver();
    });

    runtime.onMessage((message, _sender, sendResponse) => {
        if (message.type === 'URL_CHANGED') {
            handleUrlChange();
        } else if (message.type === 'MANUAL_SCAN') {
            sendResponse({ blocked: scanFeed() });
            stopObserver();
            startObserver();
            return true;
        }
    });

    if (ENV.isUserscript) {
        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                handleUrlChange();
            }
        }, 500);
    }

    state.isCurrentlyFeedPage = isFeedPage();

    if (document.body) {
        if (state.isCurrentlyFeedPage) startObserver();
    } else {
        state.waiter = new MutationObserver(() => {
            if (document.body) {
                state.waiter.disconnect();
                state.waiter = null;
                if (state.isCurrentlyFeedPage) startObserver();
            }
        });
        state.waiter.observe(document.documentElement, { childList: true });
    }
})();