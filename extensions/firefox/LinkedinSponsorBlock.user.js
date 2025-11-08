(function () {
    'use strict';

    // #region Selectors
    // Promoted texts
    const TARGET_TEXTS = [
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
        'प्रमोट किया गयाप्रमोट किया गया',
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

    // Parent containers
    const PARENTS_SELECTORS = [
        '.ember-view.occludable-update:not([data-sponsor-scanned])',
        '[class*="ember-view"][class*="occludable-update"]:not([data-sponsor-scanned])',
        'div[class*="feed-shared-update-v2"][id*="ember"]:not([data-sponsor-scanned])',
        'article[data-id="main-feed-card"]:not([data-sponsor-scanned])'
    ];

    // Promoted spans
    const SPAN_SELECTORS = [
        'span[aria-hidden="true"]:not([class]):not([id]):not([data-sponsor-scanned])',
        'span.text-color-text-low-emphasis:not([data-sponsor-scanned])',
        'span.update-components-header__text-view:not([data-sponsor-scanned])',
        'p[data-test-id="main-feed-card__header"]'
    ];
    // #endregion

    // #region Global variables
    let isScanning = false;
    let totalRemoved = 0;
    let observer = null;
    const delay = 200;
    let isObserverConnected = false;
    const URL_CHANGED = 'URL_CHANGED';
    const MANUAL_SCAN = 'MANUAL_SCAN';
    const parents = PARENTS_SELECTORS.join(',');

    // Cached feed state
    let isCurrentlyFeedPage = false;
    // #endregion

    // #region Utility method
    // Feed detection
    function isFeedPage() {
        const pathName = location.pathname;
        return pathName.startsWith('/feed') || pathName.startsWith('/preload');
    }

    // Hide post container
    function hidePostWrapper(wrapper) {
        wrapper.style.cssText = `
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
        `;
        wrapper.setAttribute('data-sponsor-scanned', 'true');
    }

    function getCandidatePosts(root) {
        if (root.nodeType === 1 && PARENTS_SELECTORS.some(sel => root.matches?.(sel))) {
            return [root];
        }
        return root.querySelectorAll?.(parents) || [];
    }

    function containsSponsoredText(post) {
        const spans = post.querySelectorAll(SPAN_SELECTORS);
        for (const span of spans) {
            const text = span.textContent?.trim().toLowerCase();
            if (TARGET_TEXTS.includes(text)) return span;
        }
        return null;
    }

    // Detect and hide
    function detectAndHideIn(root = document) {
        if (isScanning) return 0;
        isScanning = true;

        let removedCount = 0;
        const posts = getCandidatePosts(root);

        for (const post of posts) {
            const sponsoSpan = containsSponsoredText(post);
            if (!sponsoSpan) continue;

            const activityDiv = sponsoSpan.closest('div[data-id^="urn:li:activity:"]:not([data-sponsor-scanned])');
            const wrapper = activityDiv?.parentElement ?? post;

            if (wrapper) {
                hidePostWrapper(wrapper);
            } else {
                post.style.display = 'none';
            }

            removedCount++;
            totalRemoved++;
            console.debug(`[LinkedinSponsorBlock] Hidden: "${sponsoSpan.textContent.trim()}"`);

            post.setAttribute('data-sponsor-scanned', 'true');
        }

        isScanning = false;
        return removedCount;
    }

    function notify(result) {
        browser.runtime.sendMessage({ type: "BLOCKED", count: result });
    }

    // Start observer
    function startBodyObserver() {
        if (!isCurrentlyFeedPage || isObserverConnected) return;

        if (observer) observer.disconnect();

        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        const result = detectAndHideIn(node);
                        notify(result);
                    }
                }
            }
        });

        const feedDesktop = document.querySelector('[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]');
        const feedMobile = document.querySelector('ol.feed-container');

        const feedDiv = feedMobile || feedDesktop;
        if (!feedDiv) {
            setTimeout(startBodyObserver, delay);
            return;
        }


        observer.observe(feedDiv, {
            childList: true,
            subtree: true
        });

        console.debug('[LinkedinSponsorBlock] Feed detected: starting listening...');
        isObserverConnected = true;
    }
    // #endregion

    // #region URL change
    // Handle URL change
    function checkUrlChange() {
        const isStillFeedPage = isFeedPage();
        if (isStillFeedPage === isCurrentlyFeedPage) return;

        isCurrentlyFeedPage = isStillFeedPage;

        if (observer) {
            observer.disconnect();
            isObserverConnected = false;
        }

        setTimeout(() => {
            if (isCurrentlyFeedPage) {
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
            if (isCurrentlyFeedPage) {
                startBodyObserver();
            }
        }, delay);
    };

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            restartOnWake();
        } else if (document.visibilityState === 'hidden') {
            if (observer) {
                observer.disconnect();
                isObserverConnected = false;
            }
        }
    });

    browser.runtime.onMessage.addListener((msg) => {
        if (msg.type === URL_CHANGED) {
            checkUrlChange();
        }

        if (msg.type === MANUAL_SCAN) {
            const result = detectAndHideIn();
            notify(result);
            startBodyObserver();
        }
    });
    // #endregion

    // #region Start
    // Initial state setup
    isCurrentlyFeedPage = isFeedPage();

    // Start
    if (document.body) {
        if (isCurrentlyFeedPage) startBodyObserver();
    } else {
        const waiter = new MutationObserver((_, _obs) => {
            if (document.body && isCurrentlyFeedPage) {
                startBodyObserver();
            }
        });
        waiter.observe(document.documentElement, { childList: true });
    }
    // #endregion
})();