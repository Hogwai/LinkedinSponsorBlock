export function isFeedPage() {
    const path = location.pathname;
    return path === '/' || path.startsWith('/feed') || path.startsWith('/preload');
}

export function createPageManager(state, observer, resetFn) {
    function handleUrlChange() {
        const wasFeedPage = state.isCurrentlyFeedPage;
        state.isCurrentlyFeedPage = isFeedPage();
        if (state.isCurrentlyFeedPage === wasFeedPage) {
            if (state.isCurrentlyFeedPage) {
                observer.stop();
                observer.start();
            }
            return;
        }
        observer.stop();
        if (state.isCurrentlyFeedPage) {
            resetFn();
            observer.start();
        }
    }

    return { handleUrlChange };
}
