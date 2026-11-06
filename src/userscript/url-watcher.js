export function createUrlWatcher({ pageWindow, intervalMs, onChange }) {
    let originalPushState = null;
    let originalReplaceState = null;
    let lastUrl = locationKey();
    let intervalId = null;
    let started = false;

    // Hash-only navigation does not change the feed: compare path + query only.
    function locationKey() {
        const { pathname, search, href } = pageWindow.location;
        return typeof pathname === 'string' ? `${pathname}${search || ''}` : href;
    }

    function handleUrlChange() {
        const currentUrl = locationKey();
        if (currentUrl === lastUrl) return;

        lastUrl = currentUrl;
        onChange();
    }

    function startPolling() {
        if (intervalId !== null) return;
        intervalId = setInterval(handleUrlChange, intervalMs);
    }

    function stopPolling() {
        if (intervalId === null) return;
        clearInterval(intervalId);
        intervalId = null;
    }

    function onVisibilityChange() {
        if (pageWindow.document?.hidden) {
            stopPolling();
            return;
        }
        handleUrlChange();
        startPolling();
    }

    function pushState(...args) {
        originalPushState.apply(this, args);
        handleUrlChange();
    }

    function replaceState(...args) {
        originalReplaceState.apply(this, args);
        handleUrlChange();
    }

    function start() {
        if (started) return;

        originalPushState = pageWindow.history.pushState;
        originalReplaceState = pageWindow.history.replaceState;
        lastUrl = locationKey();
        pageWindow.history.pushState = pushState;
        pageWindow.history.replaceState = replaceState;
        pageWindow.addEventListener('popstate', handleUrlChange);
        pageWindow.document?.addEventListener('visibilitychange', onVisibilityChange);
        if (!pageWindow.document?.hidden) startPolling();
        started = true;
    }

    function stop() {
        if (!started) return;

        pageWindow.removeEventListener('popstate', handleUrlChange);
        pageWindow.document?.removeEventListener('visibilitychange', onVisibilityChange);
        stopPolling();
        pageWindow.history.pushState = originalPushState;
        pageWindow.history.replaceState = originalReplaceState;
        started = false;
    }

    return { start, stop };
}
