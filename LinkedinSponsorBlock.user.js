// ==UserScript==
// @name            Linkedin Sponsor Block
// @namespace       https://github.com/Hogwai/LinkedinSponsorBlock/
// @version         1.1.6
// @description:en  Remove sponsored posts, suggestions, and partner content on linkedin.com
// @description:fr  Supprime les publications sponsorisées, les suggestions et le contenu en partenariat sur linkedin.com
// @author          Hogwai
// @include         *://*.linkedin.*
// @include         *://*.linkedin.*/feed/*
// @grant           none
// @license         MIT
// @description Remove sponsored posts, suggestions, and partner content on linkedin.com
// @downloadURL https://update.greasyfork.org/scripts/546877/Linkedin%20Sponsor%20Block.user.js
// @updateURL https://update.greasyfork.org/scripts/546877/Linkedin%20Sponsor%20Block.meta.js
// ==/UserScript==

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
        // GERMAN
        'Anzeige',
        // SPANISH
        'Promocionado',
        // ARABIC
        'الترويج',
        // ITALIAN
        'Post sponsorizzato',
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
    ];

    // Promoted spans
    const SPAN_SELECTORS = [
        'span[aria-hidden="true"]:not([class]):not([id]):not([data-sponsor-processed])',
        'span.text-color-text-low-emphasis:not([data-sponsor-processed])'
    ];

    // Global variables
    let isScanning = false;
    let totalRemoved = 0;
    let observer = null;
    let lastUrl = location.href;
    const delay = 500;

    // Feed detection
    function isFeedPage() {
        return location.pathname.startsWith('/feed');
    }

    // Find the parent
    function findParentDiv(element) {
        return element.closest(PARENTS_SELECTORS.find(sel => element.closest(sel)));
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
    function createThrottledDebounce(func, delay = 300, maxWait = 500) {
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
    const throttledScan = createThrottledDebounce(scanAndClean, 300, delay);

    // Start observer
    function startBodyObserver() {
        if (!isFeedPage()) return;
        if (observer) observer.disconnect();

        observer = new MutationObserver(mutations => {
            const shouldScan =
                mutations.some(mutation => Array.from(mutation.addedNodes)
                    .some(node => node.nodeType === 1 && getNewSuspectSpans(node).length > 0));

            if (shouldScan) throttledScan();
        });


        const feedDiv = document.querySelector('[class*="scaffold-finite-scroll"][class*="scaffold-finite-scroll--infinite"]');
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
    }

    // Handle URL change
    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (observer) observer.disconnect();
            setTimeout(() => {
                if (isFeedPage()) {
                    startBodyObserver();
                } else {
                    throttledScan();
                }
            }, delay);
        }
    }

    // Events
    window.addEventListener('focus', () => {
        if (isFeedPage()) {
            setTimeout(throttledScan, delay);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isFeedPage()) {
            setTimeout(throttledScan, delay);
        }
    });

    window.addEventListener('popstate', checkUrlChange);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = (...args) => { originalPushState.apply(history, args); checkUrlChange(); };
    history.replaceState = (...args) => { originalReplaceState.apply(history, args); checkUrlChange(); };

    // Start
    if (document.body) {
        if (isFeedPage()) startBodyObserver();
    } else {
        const waiter = new MutationObserver((_, obs) => {
            if (document.body && isFeedPage()) {
                obs.disconnect();
                startBodyObserver();
            }
        });
        waiter.observe(document.documentElement, { childList: true });
    }
})();