// ==UserScript==
// @name            Linkedin Sponsor Block
// @namespace       https://github.com/Hogwai/LinkedinSponsorBlock/
// @version         1.0.1
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

    const TARGET_TEXTS = [
        // FRENCH
        'Post sponsorisé',
        'Suggestions',
        'En partenariat avec',
        'Promu(e) par ',
        'Sponsorisé • En partenariat avec',
        'Promues',
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
        '促銷內容',
    ];

    let isScanning = false;
    let totalRemoved = 0;

    function scanAndClean() {
        if (isScanning) return;
        isScanning = true;

        try {
            let removedCount = 0;

            const desktopSpans = document.querySelectorAll('span[aria-hidden="true"]:not([class]):not([id]):not([data-sponsor-processed])');
            const mobileSpans = document.querySelectorAll('span.text-color-text-low-emphasis');

            const spans = [...desktopSpans, ...mobileSpans];

            for (const span of spans) {
                const textContent = span.textContent?.trim().toLowerCase();
                if (!textContent) {
                    span.setAttribute('data-sponsor-processed', 'true');
                    continue;
                }

                const isSponsored = TARGET_TEXTS.some(text => span.textContent.trim() === text || span.textContent.includes(text));

                if (isSponsored) {
                    let parent = span.closest('.ember-view.occludable-update') ||
                        span.closest('[class*="ember-view"][class*="occludable-update"]') ||
                        span.closest('li.feed-item.new-feed.mb-1');

                    if (parent && !parent.hasAttribute('data-sponsor-removed')) {
                        parent.setAttribute('data-sponsor-removed', 'true');
                        parent.style.display = 'none';
                        removedCount++;
                        totalRemoved++;

                        if (console.debug) {
                            console.debug(`[LinkedinSponsorBlock] Hidden element : "${span.textContent.trim()}"`);
                        }
                    }
                }

                span.setAttribute('data-sponsor-processed', 'true');
            }

            if (removedCount > 0 && console.debug) {
                console.debug(`[LinkedinSponsorBlock] ${removedCount} hidden elements (Total: ${totalRemoved})`);
            }
        } catch (error) {
            console.error('[LinkedinSponsorBlock] Error while scanning:', error);
        } finally {
            isScanning = false;
        }
    }

    function createThrottledDebounce(func, delay, maxWait = 1000) {
        let timeout;
        let lastExecTime = 0;

        return function (...args) {
            const now = Date.now();

            clearTimeout(timeout);

            if (now - lastExecTime >= maxWait) {
                lastExecTime = now;
                func.apply(this, args);
                return;
            }

            timeout = setTimeout(() => {
                lastExecTime = Date.now();
                func.apply(this, args);
            }, delay);
        };
    }

    const throttledScanAndClean = createThrottledDebounce(scanAndClean, 250, 800);

    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE &&
                        (node.querySelector?.('span[aria-hidden="true"]') ||
                         node.querySelector?.('span.text-color-text-low-emphasis'))) {
                        shouldScan = true;
                        break;
                    }
                }
            }
            if (shouldScan) break;
        }

        if (shouldScan) {
            throttledScanAndClean();
        }
    });

    const observerConfig = {
        childList: true,
        subtree: true,
        attributeFilter: []
    };

    function initialize() {
        const feedDiv = document.querySelector('.scaffold-finite-scroll__content[data-finite-scroll-hotkey-context="FEED"]');
        try {
            observer.observe(feedDiv, observerConfig);
            scanAndClean();

            if (console.info) {
                console.info('[LinkedinSponsorBlock] Initialized');
            }
        } catch (error) {
            console.error('[LinkedinSponsorBlock] Error while initializing:', error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 500);
    }
})();