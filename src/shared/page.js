const POST_DETAIL_PATH = '/feed/update';

export function isFeedPage() {
    const path = location.pathname;
    return path === '/' || path.startsWith('/feed') || path.startsWith('/preload');
}

/**
 * A single post opened on its own page (/feed/update/urn:li:share:...) is a deliberate navigation, not a feed. 
 * The post is displayed on purpose, so the extension must not hide it or count it
 */
export function isPostDetailPage() {
    const path = location.pathname;
    return path === POST_DETAIL_PATH || path.startsWith(`${POST_DETAIL_PATH}/`);
}

/** Feed pages where detection is allowed to run */
export function isScannablePage() {
    return isFeedPage() && !isPostDetailPage();
}

export function createPageManager(state, observer, resetFn) {
    function handleUrlChange() {
        const wasScannable = state.isCurrentlyScannable;
        state.isCurrentlyScannable = isScannablePage();
        if (state.isCurrentlyScannable === wasScannable) {
            if (state.isCurrentlyScannable) {
                observer.stop();
                observer.start();
            }
            return;
        }
        observer.stop();
        if (state.isCurrentlyScannable) {
            resetFn();
            observer.start();
        }
    }

    return { handleUrlChange };
}
