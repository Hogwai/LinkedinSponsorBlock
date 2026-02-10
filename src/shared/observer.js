import { CONFIG } from './config.js';

export function createObserver(scanFn, state) {
    function start() {
        if (state.isObserverConnected) return;

        const { FEED_WRAPPER } = CONFIG.SELECTORS;
        const feed = document.querySelector(FEED_WRAPPER.newFeed) ||
            document.querySelector(FEED_WRAPPER.mobile);

        if (!feed) {
            setTimeout(start, CONFIG.DELAYS.OBSERVER_RETRY);
            return;
        }

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
                scanFn(document);
            }, CONFIG.DELAYS.OBSERVER_RETRY);
        });

        state.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        state.isObserverConnected = true;
        scanFn(feed);
    }

    function stop() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
            state.isObserverConnected = false;
        }
    }

    return { start, stop };
}
