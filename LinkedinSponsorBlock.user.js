// ==UserScript==
// @name            LinkedinSponsorBlock
// @namespace       https://github.com/Hogwai/LinkedinSponsorBlock/
// @version         1.0
// @description:en  Remove sponsored posts, suggestions, and partner content on linkedin.com
// @description:fr  Supprime les publications sponsorisées, les suggestions et le contenu en partenariat sur linkedin.com
// @author          Hogwai
// @include         *://*.linkedin.*
// @include         *://*.linkedin.*/feed/*
// @grant           none
// @license         MIT
// @downloadURL     https://update.greasyfork.org/scripts/546877/LinkedinSponsorBlock.user.js
// @updateURL       https://update.greasyfork.org/scripts/546877/LinkedinSponsorBlock.meta.js
// ==/UserScript==

(function () {
    'use strict';

    const FR_TARGET_TEXTS = [
        'Post sponsorisé',
        'Suggestions',
        'En partenariat avec',
        'Promu(e) par ',
        'Sponsorisé • En partenariat avec'
    ];

    const EN_TARGET_TEXTS = [
        'Promoted'
    ];

    const TARGET_TEXTS = [...FR_TARGET_TEXTS, ...EN_TARGET_TEXTS];

    function scanAndClean() {
        let removedCount = 0;
        const spans = document.querySelectorAll('span[aria-hidden="true"]:not([class]):not([id]):not([span-processed])');

        spans.forEach(span => {
            if (TARGET_TEXTS.some(text => span.textContent.trim() === text || span.textContent.includes(text))) {
                let parent = span.closest('.ember-view.occludable-update');
                if (parent) {
                    parent.remove();
                    removedCount++;
                    console.log(`[LinkedinSponsorBlock] Element removed : ${span.textContent.trim()}`);
                }
            }
            span.setAttribute('span-processed', 'true');
        });

        if (removedCount > 0) {
            console.log(`[LinkedinSponsorBlock] ${removedCount} elements removed.`);
        }
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const debouncedScanAndClean = debounce(scanAndClean, 300);

    const observer = new MutationObserver((mutations) => {
        const hasAddedNodes = mutations.some(mutation => mutation.addedNodes.length > 0);
        if (hasAddedNodes) {
            debouncedScanAndClean();
        }
    });

    const observerConfig = {
        childList: true,
        subtree: true
    };

    observer.observe(document.body, observerConfig);

    scanAndClean();
})();