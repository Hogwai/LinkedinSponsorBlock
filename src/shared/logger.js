export const logger = {
    enabled: false,
    _startupMessageShown: false,
    _idleCallbackId: null,
    buffer: [],
    scheduled: false,

    setEnabled(value) {
        this.enabled = value;
        if (!value) {
            // Clear pending buffered logs
            if (this._idleCallbackId !== null) {
                cancelIdleCallback(this._idleCallbackId);
                this._idleCallbackId = null;
            }
            this.buffer = [];
            this.scheduled = false;

            // Show startup message once
            if (!this._startupMessageShown) {
                this._startupMessageShown = true;
                console.log('[LinkedinSponsorBlock] Logging is disabled. Enable it from the settings to see logs.');
            }
        }
    },

    log(message) {
        if (!this.enabled) return;
        this.buffer.push(message);
        if (!this.scheduled) {
            this.scheduled = true;
            this._idleCallbackId = requestIdleCallback(() => {
                console.groupCollapsed(`[LinkedinSponsorBlock] ${this.buffer.length} hidden`);
                this.buffer.forEach(msg => console.debug(msg));
                console.groupEnd();
                this.buffer = [];
                this.scheduled = false;
                this._idleCallbackId = null;
            }, { timeout: 1000 });
        }
    },

    info(message) {
        if (!this.enabled) return;
        console.log(`[LinkedinSponsorBlock] ${message}`);
    }
};
