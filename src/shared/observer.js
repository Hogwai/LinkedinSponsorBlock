import { CONFIG } from './config.js';

export function createObserver(scanFn, state) {
    let retryCount = 0;

    function findFeed() {
        const { FEED_WRAPPER } = CONFIG.SELECTORS;
        return document.querySelector(FEED_WRAPPER.newFeed) ||
            document.querySelector(FEED_WRAPPER.mobile) ||
            document.querySelector(FEED_WRAPPER.desktop);
    }

    function connect(root) {
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
        retryCount = 0;
        scanFn(root);
    }

    function start() {
        if (state.isObserverConnected) return;

        const feed = findFeed();

        if (feed) {
            connect(feed);
            return;
        }

        if (retryCount < CONFIG.DELAYS.MAX_OBSERVER_RETRIES) {
            retryCount++;
            setTimeout(start, CONFIG.DELAYS.OBSERVER_RETRY);
            return;
        }

        // Feed wrapper not found after retries — start anyway with document
        connect(document);
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
