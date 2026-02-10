export const logger = {
    buffer: [],
    scheduled: false,
    log(message) {
        this.buffer.push(message);
        if (!this.scheduled) {
            this.scheduled = true;
            requestIdleCallback(() => {
                console.groupCollapsed(`[LinkedinSponsorBlock] ${this.buffer.length} hidden`);
                this.buffer.forEach(msg => console.debug(msg));
                console.groupEnd();
                this.buffer = [];
                this.scheduled = false;
            }, { timeout: 1000 });
        }
    }
};
