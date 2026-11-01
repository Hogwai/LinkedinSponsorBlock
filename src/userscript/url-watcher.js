export function createUrlWatcher({ pageWindow, intervalMs, onChange }) {
    let originalPushState = null;
    let originalReplaceState = null;
    let lastUrl = pageWindow.location.href;
    let intervalId = null;
    let started = false;

    function handleUrlChange() {
        const currentUrl = pageWindow.location.href;
        if (currentUrl === lastUrl) return;

        lastUrl = currentUrl;
        onChange();
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
        lastUrl = pageWindow.location.href;
        pageWindow.history.pushState = pushState;
        pageWindow.history.replaceState = replaceState;
        pageWindow.addEventListener('popstate', handleUrlChange);
        intervalId = setInterval(handleUrlChange, intervalMs);
        started = true;
    }

    function stop() {
        if (!started) return;

        pageWindow.removeEventListener('popstate', handleUrlChange);
        clearInterval(intervalId);
        intervalId = null;
        pageWindow.history.pushState = originalPushState;
        pageWindow.history.replaceState = originalReplaceState;
        started = false;
    }

    return { start, stop };
}
