const VERBOSE_FLAG_KEY = 'lsb_debug';

/**
 * Two independent logging toggles:
 *  - simple logging (setEnabled) prints concise per-post decisions;
 *  - detailed logging (setVerbose) prints the match reason and the kept posts.
 * Either one alone produces logs. Detailed only changes the format.
 * Maintainer shortcut for detailed mode:
 *   localStorage.setItem('lsb_debug', '1')   // then reload the page
 * The localStorage flag always forces detailed mode on, even after setVerbose(false).
 */
function readVerboseFlag() {
    try {
        return globalThis.localStorage?.getItem(VERBOSE_FLAG_KEY) === '1';
    } catch {
        return false;
    }
}

export const logger = {
    enabled: false,
    verbose: false,
    _startupMessageShown: false,
    _idleCallbackId: null,
    buffer: [],
    scheduled: false,

    /** Logging is on as soon as one of the two toggles is on. They are independent. */
    isActive() {
        return this.enabled || this.verbose;
    },

    setEnabled(value) {
        this.enabled = value;
        if (!this.isActive()) {
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
                console.log(
                    '[LinkedinSponsorBlock] Logging is disabled. Enable it from the settings to see logs.',
                );
            }
        }
    },

    setVerbose(value) {
        this.verbose = Boolean(value) || readVerboseFlag();
    },

    log(message) {
        if (!this.isActive()) return;
        this.buffer.push(message);
        if (!this.scheduled) {
            this.scheduled = true;
            this._idleCallbackId = requestIdleCallback(
                () => {
                    const kind = this.verbose ? 'log(s)' : 'hidden';
                    console.groupCollapsed(`[LinkedinSponsorBlock] ${this.buffer.length} ${kind}`);
                    this.buffer.forEach((msg) => console.debug(msg));
                    console.groupEnd();
                    this.buffer = [];
                    this.scheduled = false;
                    this._idleCallbackId = null;
                },
                { timeout: 1000 },
            );
        }
    },

    info(message) {
        if (!this.isActive()) return;
        console.log(`[LinkedinSponsorBlock] ${message}`);
    },

    warn(message, error) {
        if (!this.isActive()) return;
        if (error) {
            console.warn(`[LinkedinSponsorBlock] ${message}`, error);
        } else {
            console.warn(`[LinkedinSponsorBlock] ${message}`);
        }
    },
};
