// ==UserScript==
// @name            Linkedin Sponsor Block
// @namespace       https://github.com/Hogwai/LinkedinSponsorBlock/
// @version         1.1.5
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

    // Promoted posts cards
    const PARENTS_SELECTORS = [
        '.ember-view.occludable-update',
        '[class*="ember-view"][class*="occludable-update"]',
        'div[class*="feed-shared-update-v2"][id*="ember"]',
        'li.feed-item.new-feed.mb-1'
    ];

    // Global variables
    let isScanning = false;
    let totalRemoved = 0;
    let observer = null;
    let lastUrl = location.href;
    const delay = 500;

    // Detects if the current page is the feed
    function isFeedPage() {
        return location.pathname.startsWith('/feed');
    }

    // Find the parent div
    function findParentDiv(element) {
        for (const selector of PARENTS_SELECTORS) {
            const parent = element.closest(selector);
            if (parent) return parent;
        }
        return null;
    }

    // Scan and hide promoted posts
    function scanAndClean() {
        if (isScanning || !document.body) return;
        isScanning = true;

        let removedCount = 0;

        // Clean before rescanning
        document.querySelectorAll('[data-sponsor-processed]').forEach(el => el.removeAttribute('data-sponsor-processed'));

        const spans = document.querySelectorAll(`
            span[aria-hidden="true"]:not([class]):not([id]),
            span.text-color-text-low-emphasis
        `);

        for (const span of spans) {
            const text = span.textContent?.trim();
            if (!text) continue;

            const lowerText = text.toLowerCase();
            const isSponsored = TARGET_TEXTS.some(t => lowerText === t || lowerText.includes(t));

            if (isSponsored) {
                const parent = findParentDiv(span);
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

    // Throttle & debounce
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

    // Start body observer
    function startBodyObserver() {
        if (!isFeedPage()) return;

        if (observer) observer.disconnect();

        observer = new MutationObserver(throttledScan);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(scanAndClean, 1000);
        setTimeout(scanAndClean, 3000);

        console.log('[LinkedinSponsorBlock] Feed detected: starting listening...');
    }

    // Listen SPA navigation
    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (observer) observer.disconnect();
            setTimeout(() => {
                if (isFeedPage()) {
                    startBodyObserver();
                } else {
                    scanAndClean();
                }
            }, delay);
        }
    }

    // Listen scroll
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (!isFeedPage()) return;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(throttledScan, delay);
    }, { passive: true });

    // Listen focus change
    window.addEventListener('focus', () => {
        if (isFeedPage()) setTimeout(throttledScan, delay);
    });

    // Listen visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isFeedPage()) {
            setTimeout(throttledScan, delay);
        }
    });

    // Listen history change
    window.addEventListener('popstate', checkUrlChange);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = (...args) => { originalPushState.apply(history, args); checkUrlChange(); };
    history.replaceState = (...args) => { originalReplaceState.apply(history, args); checkUrlChange(); };

    // Detecting the body load
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