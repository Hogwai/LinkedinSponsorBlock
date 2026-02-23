export function isFeedPage() {
    const path = location.pathname;
    return path === '/' || path.startsWith('/feed') || path.startsWith('/preload');
}

export function createPageManager(state, observer, resetFn) {
    function handleUrlChange() {
        const wasFeedPage = state.isCurrentlyFeedPage;
        state.isCurrentlyFeedPage = isFeedPage();
        if (state.isCurrentlyFeedPage === wasFeedPage) return;
        observer.stop();
        if (state.isCurrentlyFeedPage) {
            resetFn();
            observer.start();
        }
    }

    return { handleUrlChange };
}
