export const MESSAGE_TYPES = Object.freeze({
    URL_CHANGED: 'URL_CHANGED',
    MANUAL_SCAN: 'MANUAL_SCAN',
    SETTINGS_CHANGED: 'SETTINGS_CHANGED',
    BLOCKED: 'BLOCKED',
    COUNTER_UPDATE: 'COUNTER_UPDATE',
    GET_COUNTERS: 'GET_COUNTERS',
    RESET_COUNTERS: 'RESET_COUNTERS',
    FETCH_REMOTE_CONFIG: 'FETCH_REMOTE_CONFIG'
});

export function createUrlChangedMessage(url) {
    return { type: MESSAGE_TYPES.URL_CHANGED, url };
}

export function createManualScanMessage() {
    return { type: MESSAGE_TYPES.MANUAL_SCAN };
}

export function createSettingsChangedMessage(settings) {
    return { type: MESSAGE_TYPES.SETTINGS_CHANGED, ...settings };
}

export function createBlockedMessage({ promoted = 0, suggested = 0 } = {}) {
    return { type: MESSAGE_TYPES.BLOCKED, promoted, suggested };
}

export function createCounterUpdateMessage({ promoted = 0, suggested = 0 } = {}) {
    return { type: MESSAGE_TYPES.COUNTER_UPDATE, promoted, suggested };
}

export function createResetCountersMessage() {
    return { type: MESSAGE_TYPES.RESET_COUNTERS };
}

export function createFetchRemoteConfigMessage() {
    return { type: MESSAGE_TYPES.FETCH_REMOTE_CONFIG };
}
