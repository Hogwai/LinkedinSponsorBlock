import { CONFIG } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { createBlockedMessage } from '../shared/messages.js';

export function createNotifier({
    state,
    sendMessage,
    notificationDelay = CONFIG.DELAYS.NOTIFICATION,
    scheduleIdle = (cb, options) => requestIdleCallback(cb, options),
    cancelIdle = (id) => cancelIdleCallback(id),
}) {
    let pending = false;
    let scheduled = false;
    let timeoutId = null;
    let idleCallbackId = null;
    let lastNotifiedPromoted = 0;
    let lastNotifiedSuggested = 0;
    let lastNotifiedScanned = 0;

    function flush() {
        if (!pending) return;

        const promoted = state.sessionPromotedRemoved - lastNotifiedPromoted;
        const suggested = state.sessionSuggestedRemoved - lastNotifiedSuggested;
        const scanned = state.sessionPostsScanned - lastNotifiedScanned;

        if (promoted > 0 || suggested > 0 || scanned > 0) {
            sendMessage(createBlockedMessage({ promoted, suggested, scanned })).catch((err) => {
                logger.warn('Failed to send blocked message to background', err);
            });

            lastNotifiedPromoted = state.sessionPromotedRemoved;
            lastNotifiedSuggested = state.sessionSuggestedRemoved;
            lastNotifiedScanned = state.sessionPostsScanned;
        }

        pending = false;
    }

    function queue() {
        pending = true;
        if (scheduled) return;

        scheduled = true;
        timeoutId = setTimeout(() => {
            timeoutId = null;
            idleCallbackId = scheduleIdle(
                () => {
                    idleCallbackId = null;
                    flush();
                    scheduled = false;
                },
                { timeout: 500 },
            );
        }, notificationDelay);
    }

    function cancel() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (idleCallbackId !== null) {
            cancelIdle(idleCallbackId);
            idleCallbackId = null;
        }
        pending = false;
        scheduled = false;
    }

    function reset() {
        lastNotifiedPromoted = 0;
        lastNotifiedSuggested = 0;
        lastNotifiedScanned = 0;
    }

    return { queue, cancel, reset };
}
