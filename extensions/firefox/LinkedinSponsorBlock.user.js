(function () {
    'use strict';

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
        '.ember-view.occludable-update',
        '[class*="ember-view"][class*="occludable-update"]',
        'div[class*="feed-shared-update-v2"][id*="ember"]',
        'li.feed-item.new-feed.mb-1'
    ].join(',');

    // Promoted spans
    const SPAN_SELECTORS = [
        'span[aria-hidden="true"]:not([class]):not([id]):not([data-sponsor-processed])',
        'span.text-color-text-low-emphasis:not([data-sponsor-processed])',
        'span.update-components-header__text-view:not([data-sponsor-processed])'
    ];

    // Global variables
    let isScanning = false;
    let totalRemoved = 0;
    let observer = null;
    let lastUrl = location.href;
    const delay = 200;
    let isObserverConnected = false;

    // Feed detection
    function isFeedPage() {
        const pathName = location.pathname;
        return pathName.startsWith('/feed') || pathName.startsWith('/preload');
    }

    // Find spans
    function getNewSuspectSpans(root = document) {
        return root.querySelectorAll(SPAN_SELECTORS);
    }

    // Scan and hide
    function scanAndClean() {
        if (isScanning || !document.body) return;
        isScanning = true;

        let removedCount = 0;
        const spans = getNewSuspectSpans();

        for (const span of spans) {
            const text = span.textContent?.trim();
            if (!text) continue;

            const lowerText = text.toLowerCase();
            const isSponsored = TARGET_TEXTS.some(t => lowerText === t || lowerText.includes(t));

            if (isSponsored) {
                const parent = span.closest(PARENTS_SELECTORS);
                if (parent && !parent.hasAttribute('data-sponsor-removed')) {
                    parent.style.display = 'none';
                    parent.setAttribute('data-sponsor-removed', 'true');
                    removedCount++;
                    totalRemoved++;
                    console.log(`[LinkedinSponsorBlock] Hidden element: "${text}"`);
                }
            }
            span.setAttribute('data-sponsor-processed', 'true');
        }

        if (removedCount > 0) {
            console.log(`[LinkedinSponsorBlock] ${removedCount} hidden elements (Total: ${totalRemoved})`);
        }

        isScanning = false;
    }

    // Throttle + debounce
    function createThrottledDebounce(func, delay = 100, maxWait = 300) {
        let timeout, lastExec = 0;
        return (...args) => {
            const now = Date.now();
            clearTimeout(timeout);
            if (now - lastExec >= maxWait) {
                lastExec = now;
                return func(...args);
            }
            timeout = setTimeout(() => {
                lastExec = Date.now();
                func(...args);
            }, delay);
        };
    }
    const throttledScan = createThrottledDebounce(scanAndClean, delay, 300);

    // Start observer
    function startBodyObserver() {
        if (!isFeedPage() || isObserverConnected) {
            return;
        }

        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(mutations => {
            const shouldScan =
                mutations.some(mutation => Array.from(mutation.addedNodes)
                    .some(node => node.nodeType === 1 && getNewSuspectSpans(node).length > 0));

            if (shouldScan) throttledScan();
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

        // Init
        setTimeout(throttledScan, delay);
        console.log('[LinkedinSponsorBlock] Feed detected: starting listening...');
        isObserverConnected = true;
    }

    // Handle URL change
    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (observer) {
                observer.disconnect();
                isObserverConnected = false;
            }
            setTimeout(() => {
                if (isFeedPage()) {
                    startBodyObserver();
                }
            }, delay);
        }
    }

    // Events
    window.addEventListener('focus', () => {
        restartOnWake();
    });

    const restartOnWake = () => {
        setTimeout(() => {
            if (isFeedPage()) {
                scanAndClean();
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
        if (msg.type === 'URL_CHANGED') {
            checkUrlChange();
        }
    });

    // Start
    if (document.body) {
        if (isFeedPage()) startBodyObserver();
    } else {
        const waiter = new MutationObserver((_, obs) => {
            if (document.body && isFeedPage()) {
                startBodyObserver();
            }
        });
        waiter.observe(document.documentElement, { childList: true });
    }
})();