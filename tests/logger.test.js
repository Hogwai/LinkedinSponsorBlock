import { describe, it, expect, beforeEach, vi } from 'vitest';

let logger;

beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../src/shared/logger.js');
    logger = mod.logger;
});

describe('initial state', () => {
    it('has logging disabled by default', () => {
        expect(logger.enabled).toBe(false);
    });

    it('has an empty buffer', () => {
        expect(logger.buffer).toEqual([]);
    });

    it('is not scheduled', () => {
        expect(logger.scheduled).toBe(false);
    });

    it('has not shown startup message', () => {
        expect(logger._startupMessageShown).toBe(false);
    });
});

describe('setEnabled', () => {
    it('enables logging', () => {
        logger.setEnabled(true);
        expect(logger.enabled).toBe(true);
    });

    it('disables logging and clears buffer', () => {
        logger.setEnabled(true);
        logger.log('test');
        expect(logger.buffer.length).toBe(1);

        logger.setEnabled(false);
        expect(logger.enabled).toBe(false);
        expect(logger.buffer).toEqual([]);
        expect(logger.scheduled).toBe(false);
    });

    it('logs startup message once when disabling', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

        logger.setEnabled(false);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(
            '[LinkedinSponsorBlock] Logging is disabled. Enable it from the settings to see logs.',
        );

        logger.setEnabled(false);
        expect(spy).toHaveBeenCalledTimes(1); // still once

        spy.mockRestore();
    });
});

describe('log', () => {
    it('does nothing when disabled', () => {
        const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        logger.log('test message');
        expect(logger.buffer).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('buffers messages when enabled', () => {
        logger.setEnabled(true);
        logger.log('msg1');
        expect(logger.buffer).toEqual(['msg1']);
    });

    it('schedules idle callback on first log', () => {
        logger.setEnabled(true);
        expect(logger.scheduled).toBe(false);

        logger.log('msg1');
        expect(logger.scheduled).toBe(true);
        expect(logger._idleCallbackId).not.toBe(null);
    });

    it('does not re-schedule for subsequent logs', () => {
        logger.setEnabled(true);
        logger.log('msg1');
        const firstId = logger._idleCallbackId;

        logger.log('msg2');
        expect(logger._idleCallbackId).toBe(firstId);
    });

    it('flushes buffer via idle callback', () => {
        logger.setEnabled(true);
        const groupCollapsed = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
        const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
        const groupEnd = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});

        // Intercept requestIdleCallback to control when it fires
        let idleCb;
        const origRaf = globalThis.requestIdleCallback;
        globalThis.requestIdleCallback = (cb) => {
            idleCb = cb;
            return 999;
        };

        logger.log('msg1');
        logger.log('msg2');

        // Fire the callback manually
        idleCb({ didTimeout: false, timeRemaining: () => 0 });

        expect(groupCollapsed).toHaveBeenCalledWith(
            '[LinkedinSponsorBlock] 2 hidden',
        );
        expect(debug).toHaveBeenCalledWith('msg1');
        expect(debug).toHaveBeenCalledWith('msg2');
        expect(groupEnd).toHaveBeenCalled();
        expect(logger.buffer).toEqual([]);
        expect(logger.scheduled).toBe(false);
        expect(logger._idleCallbackId).toBe(null);

        globalThis.requestIdleCallback = origRaf;
        groupCollapsed.mockRestore();
        debug.mockRestore();
        groupEnd.mockRestore();
    });
});

describe('info', () => {
    it('does nothing when disabled', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        logger.info('test');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs message when enabled', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        logger.setEnabled(true);
        logger.info('hello');
        expect(spy).toHaveBeenCalledWith('[LinkedinSponsorBlock] hello');
        spy.mockRestore();
    });
});

describe('warn', () => {
    it('does nothing when disabled', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        logger.warn('test');
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('logs warning when enabled', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        logger.setEnabled(true);
        logger.warn('something went wrong');
        expect(spy).toHaveBeenCalledWith(
            '[LinkedinSponsorBlock] something went wrong',
        );
        spy.mockRestore();
    });

    it('logs warning with error when enabled', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const err = new Error('test error');
        logger.setEnabled(true);
        logger.warn('error occurred', err);
        expect(spy).toHaveBeenCalledWith(
            '[LinkedinSponsorBlock] error occurred',
            err,
        );
        spy.mockRestore();
    });
});
