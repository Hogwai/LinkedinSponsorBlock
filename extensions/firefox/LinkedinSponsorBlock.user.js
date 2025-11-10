(function () {
    'use strict';

    // #region Selectors
    // Promoted texts
    const PROMOTED_TEXTS = [
        // FRENCH
        'Post sponsorisé',
        'Suggestions',
        'En partenariat avec',
        'Promu(e) par ',
        'Sponsorisé • En partenariat avec',
        'Promues',
        'Promu(e) par',
        // ENGLISH
        'Promoted',
        'Suggested',
        // GERMAN
        'Anzeige',
        'Vorgeschlagen',
        // SPANISH
        'Promocionado',
        'Sugerencias',
        // ARABIC
        'الترويج',
        // ITALIAN
        'Post sponsorizzato',
        'Promosso da',
        // BANGLA
        'প্রমোটেড',
        // CZECH
        'Propagováno',
        // DANISH
        'Promoveret',
        // GREEK
        'Προωθημένη',
        // PERSIAN
        'تبلیغ‌شده',
        // FINNISH
        'Mainostettu',
        // HINDI
        'प्रमोट किया गया',
        // HUNGARIAN
        'Kiemelt',
        // INDONESIAN
        'Dipromosikan',
        // HEBREW
        'ממומן',
        // JAPONESE
        'プロモーション',
        // KOREAN
        '광고',
        '추천됨',
        '주최:',
        // MARATHI
        'प्रमोट केले',
        // MALAYSIAN
        'Dipromosikan',
        // DUTCH
        'Gepromoot',
        // NORWEGIAN
        'Promotert',
        // PUNJABI
        'ਪ੍ਰੋਮੋਟ ਕੀਤਾ ਗਿਆ',
        // POLISH
        'Treść promowana',
        // PORTUGUESE
        'Promovido',
        'Sugestões',
        // ROMANIAN
        'Promovat',
        // RUSSIAN
        'Продвигается',
        // SWEDISH
        'Marknadsfört',
        // TELUGU
        'ప్రమోట్ చేయబడింది',
        // THAI
        'ได้รับการโปรโมท',
        // TAGALOG
        'Nai-promote',
        // TURKISH
        'Öne çıkarılan içerik',
        // UKRAINIAN
        'Просувається',
        // VIETNAMESE
        'Được quảng bá',
        // CHINESE (SIMPLIFIED)
        '广告',
        // CHINESE (TRADITIONAL)
        '促銷內容'
    ].map(t => t.toLowerCase());

    const PROMOTED_TEXTS_SET = new Set(PROMOTED_TEXTS);

    // Parent containers
    const PARENTS_SELECTORS = [
        '.ember-view.occludable-update:not([data-sponsor-scanned])',
        '[class*="ember-view"][class*="occludable-update"]:not([data-sponsor-scanned])',
        'div[class*="feed-shared-update-v2"][id*="ember"]:not([data-sponsor-scanned])',
        'article[data-id="main-feed-card"]:not([data-sponsor-scanned])'
    ];

    // Promoted elements
    const PROMOTED_ELEMENTS = [
        'span[aria-hidden="true"]:not([class]):not([id]):not([data-sponsor-scanned])',
        'span.text-color-text-low-emphasis:not([data-sponsor-scanned])',
        'span.update-components-header__text-view:not([data-sponsor-scanned])',
        'p[data-test-id="main-feed-card__header"]'
    ];

    const POST_CONTAINER = 'div[data-id^="urn:li:activity:"]:not([data-sponsor-scanned])';
    // #endregion

    // #region Global variables
    const state = {
        isScanning: false,
        totalRemoved: 0,
        observer: null,
        waiter: null,
        sessionRemoved: 0,
        isObserverConnected: false,
        isCurrentlyFeedPage: false
    };

    const delay = 200;
    const URL_CHANGED = 'URL_CHANGED';
    const MANUAL_SCAN = 'MANUAL_SCAN';
    const parents = PARENTS_SELECTORS.join(',');
    // #endregion

    // #region Utility method
    const style = document.createElement('style');
    style.textContent = `
        .linkedin-sponsor-blocker-hidden {
            opacity: 0 !important;
            transform: scaleY(0) !important;
            transform-origin: top !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            min-height: 0 !important;
            height: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            transition: none !important;
            contain: layout style paint !important;
        }
    `;
    (document.head || document.documentElement).appendChild(style);

    function resetStats() {
        state.sessionRemoved = 0;
    }

    // Feed detection
    function isFeedPage() {
        const pathName = location.pathname;
        return pathName.startsWith('/feed') || pathName.startsWith('/preload');
    }

    // Hide element with the css class
    function hideElementClass(element) {
        element.classList.add('linkedin-sponsor-blocker-hidden');
        element.setAttribute('data-sponsor-scanned', 'true');
        state.sessionRemoved++;
    }

    // Hide element with none
    function hideElementNone(element) {
        element.style.display = 'none';
        element.setAttribute('data-sponsor-scanned', 'true');
        state.sessionRemoved++;
    }

    function getCandidatePosts(root) {
        if (root.nodeType === 1 && PARENTS_SELECTORS.some(sel => root.matches?.(sel))) {
            return [root];
        }
        return root.querySelectorAll?.(parents) || [];
    }

    function getPromotedElement(post) {
        const promotedElements = post.querySelectorAll(PROMOTED_ELEMENTS);
        for (const element of promotedElements) {
            const text = element.textContent?.trim().toLowerCase();
            if (PROMOTED_TEXTS_SET.has(text)) return element;

            for (const promoText of PROMOTED_TEXTS) {
                if (text.startsWith(promoText) || text.includes(promoText)) {
                    return element;
                }
            }
        }
        return null;
    }

    function hideStaticPromotedElements() {
        const sectionAdBanner = document.querySelector('section[class*="ad-banner-container"]:not([data-sponsor-scanned])');
        if (sectionAdBanner) {
            hideElementNone(sectionAdBanner);
            console.debug('[LinkedinSponsorBlock] Hidden: ad-banner-container');
        }
    }

    // Detect and hide
    function detectAndHideIn(root = document) {
        if (state.isScanning) return 0;
        state.isScanning = true;

        let removedCount = 0;
        const posts = getCandidatePosts(root);

        for (const post of posts) {
            const promoted = getPromotedElement(post);
            if (!promoted) continue;

            const activityDiv = promoted.closest(POST_CONTAINER);
            const wrapper = activityDiv?.parentElement ?? post;

            if (wrapper) {
                hideElementClass(wrapper);
            } else {
                post.style.display = 'none';
            }

            removedCount++;
            state.totalRemoved++;
            console.debug(`[LinkedinSponsorBlock] Hidden: "${promoted.textContent.trim()}"`);

            post.setAttribute('data-sponsor-scanned', 'true');
        }

        state.isScanning = false;
        return removedCount;
    }

    function notify(result) {
        if (result > 0) {
            state.sessionRemoved += result;
            browser.runtime.sendMessage({ type: "BLOCKED", count: state.sessionRemoved });
        }
    }

    // Start observer
    function startBodyObserver() {
        if (!state.isCurrentlyFeedPage || state.isObserverConnected) return;

        if (state.observer) state.observer.disconnect();

        const processNodes = (nodes) => {
            for (const node of nodes) {
                if (node.nodeType === 1) {
                    const result = detectAndHideIn(node);
                    notify(result);
                }
            }
        };

        state.observer = new MutationObserver(mutations => {
            const nodesToProcess = [];
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    nodesToProcess.push(node);
                }
            }

            if (nodesToProcess.length > 0) {
                processNodes(nodesToProcess);
            }
        });

        const feedDesktop = document.querySelector('[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]');
        const feedMobile = document.querySelector('ol.feed-container');

        const feedDiv = feedMobile || feedDesktop;
        if (!feedDiv) {
            setTimeout(startBodyObserver, delay);
            return;
        }


        state.observer.observe(feedDiv, {
            childList: true,
            subtree: true
        });

        console.debug('[LinkedinSponsorBlock] Feed detected: starting listening...');
        state.isObserverConnected = true;
        detectAndHideIn(feedDiv);
        requestIdleCallback(() => hideStaticPromotedElements());
    }
    // #endregion

    // #region URL change
    // Handle URL change
    function checkUrlChange() {
        const isStillFeedPage = isFeedPage();
        if (isStillFeedPage === state.isCurrentlyFeedPage) return;

        state.isCurrentlyFeedPage = isStillFeedPage;

        if (state.observer) {
            state.observer.disconnect();
            state.isObserverConnected = false;
        }
        if (state.waiter) state.waiter.disconnect();
        state.observer = state.waiter = null;

        setTimeout(() => {
            if (state.isCurrentlyFeedPage) {
                resetStats();
                const result = detectAndHideIn();
                notify(result);
                startBodyObserver();
            }
        }, delay);
    }
    // #endregion

    // #region Event listening
    // Events
    const restartOnWake = () => {
        setTimeout(() => {
            if (state.isCurrentlyFeedPage) {
                startBodyObserver();
            }
        }, delay);
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            restartOnWake();
        } else if (document.visibilityState === 'hidden') {
            if (state.observer) {
                state.observer.disconnect();
                state.isObserverConnected = false;
            }
        }
    });

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === URL_CHANGED) {
            checkUrlChange();
        }

        if (message.type === MANUAL_SCAN) {
            const result = detectAndHideIn();
            notify(result);
            startBodyObserver();
            sendResponse({ blocked: result });
        }
    });
    // #endregion

    // #region Start
    // Initial state setup
    state.isCurrentlyFeedPage = isFeedPage();

    // Start
    if (document.body) {
        if (state.isCurrentlyFeedPage) startBodyObserver();
    } else {
        state.waiter = new MutationObserver((_, _obs) => {
            if (document.body && state.isCurrentlyFeedPage) {
                startBodyObserver();
            }
        });
        state.waiter.observe(document.documentElement, { childList: true });
    }
    // #endregion
})();