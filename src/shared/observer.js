import { CONFIG, applyLayout, getActiveProfile } from './config.js';
import { applyRemoteOverrides } from './remote-config.js';

const LAYOUT_MARKERS = [
    { name: 'modern', selectors: ['body[data-rehydrated]'] },
    { name: 'legacy', selectors: ['body.ember-application'] }
];

function detectLayout() {
    for (const { name, selectors } of LAYOUT_MARKERS) {
        if (selectors.some(s => document.querySelector(s))) {
            return name;
        }
    }
    return null;
}

function findFeedWrapper(profile) {
    const wrappers = profile.feedWrapper;
    for (const key of ['newFeed', 'mobile', 'desktop']) {
        if (wrappers[key]) {
            const el = document.querySelector(wrappers[key]);
            if (el) return el;
        }
    }
    return null;
}

export function createObserver(scanFn, state) {
    let retryCount = 0;
    let layoutApplied = false;

    function findFeed() {
        if (!layoutApplied) {
            const layoutName = detectLayout();
            if (layoutName) {
                if (applyLayout(layoutName)) {
                    applyRemoteOverrides(layoutName);
                    layoutApplied = true;
                }
            }
        }

        return findFeedWrapper(getActiveProfile());
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

        // Feed wrapper not found after retries, start anyway with document
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
