import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let createNotifier;
let logger;

beforeEach(async () => {
    vi.resetModules();
    ({ createNotifier } = await import('../src/extension/notifier.js'));
    ({ logger } = await import('../src/shared/logger.js'));
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function makeState(overrides = {}) {
    return {
        sessionPromotedRemoved: 0,
        sessionSuggestedRemoved: 0,
        sessionPostsScanned: 0,
        ...overrides,
    };
}

function makeNotifier(state = makeState()) {
    let idleCallback = null;
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const cancelIdle = vi.fn();
    const notifier = createNotifier({
        state,
        sendMessage,
        notificationDelay: 100,
        scheduleIdle(cb) {
            idleCallback = cb;
            return 42;
        },
        cancelIdle,
    });

    return {
        notifier,
        state,
        sendMessage,
        cancelIdle,
        runIdle() {
            idleCallback({ didTimeout: false, timeRemaining: () => 0 });
        },
    };
}

describe('createNotifier', () => {
    it('sends only the new counters after the notification delay', () => {
        const h = makeNotifier(
            makeState({
                sessionPromotedRemoved: 2,
                sessionSuggestedRemoved: 1,
                sessionPostsScanned: 8,
            }),
        );

        h.notifier.queue();
        h.notifier.queue();
        expect(h.sendMessage).not.toHaveBeenCalled();

        vi.advanceTimersByTime(99);
        expect(h.sendMessage).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        h.runIdle();

        expect(h.sendMessage).toHaveBeenCalledTimes(1);
        expect(h.sendMessage).toHaveBeenCalledWith({
            type: 'BLOCKED',
            promoted: 2,
            suggested: 1,
            scanned: 8,
        });
    });

    it('does not send when counters did not change', () => {
        const h = makeNotifier();

        h.notifier.queue();
        vi.advanceTimersByTime(100);
        h.runIdle();

        expect(h.sendMessage).not.toHaveBeenCalled();
    });

    it('cancels a pending timeout', () => {
        const h = makeNotifier(makeState({ sessionPromotedRemoved: 1 }));

        h.notifier.queue();
        h.notifier.cancel();
        vi.advanceTimersByTime(100);

        expect(h.sendMessage).not.toHaveBeenCalled();
        expect(h.cancelIdle).not.toHaveBeenCalled();
    });

    it('cancels a pending idle callback and ignores a late flush', () => {
        const h = makeNotifier(makeState({ sessionPromotedRemoved: 1 }));

        h.notifier.queue();
        vi.advanceTimersByTime(100);
        h.notifier.cancel();

        expect(h.cancelIdle).toHaveBeenCalledWith(42);

        h.runIdle();
        expect(h.sendMessage).not.toHaveBeenCalled();
    });

    it('reset makes already-notified counters eligible again', () => {
        const h = makeNotifier(makeState({ sessionPromotedRemoved: 3 }));

        h.notifier.queue();
        vi.advanceTimersByTime(100);
        h.runIdle();
        h.notifier.reset();
        h.notifier.queue();
        vi.advanceTimersByTime(100);
        h.runIdle();

        expect(h.sendMessage).toHaveBeenCalledTimes(2);
        expect(h.sendMessage).toHaveBeenLastCalledWith({
            type: 'BLOCKED',
            promoted: 3,
            suggested: 0,
            scanned: 0,
        });
    });

    it('logs a warning when sending the message fails', async () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const h = makeNotifier(makeState({ sessionPromotedRemoved: 1 }));
        h.sendMessage.mockRejectedValueOnce(new Error('boom'));

        h.notifier.queue();
        vi.advanceTimersByTime(100);
        h.runIdle();
        await Promise.resolve();

        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to send blocked message to background',
            expect.any(Error),
        );
    });
});
