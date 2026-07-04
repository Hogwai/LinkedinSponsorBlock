import { describe, it, expect } from 'vitest';
import {
    MESSAGE_TYPES,
    createUrlChangedMessage,
    createManualScanMessage,
    createSettingsChangedMessage,
    createBlockedMessage,
    createCounterUpdateMessage,
    createResetCountersMessage,
    createFetchRemoteConfigMessage,
} from '../src/shared/messages.js';

describe('messages.js', () => {
    describe('MESSAGE_TYPES', () => {
        it('defines all message types as frozen', () => {
            expect(Object.isFrozen(MESSAGE_TYPES)).toBe(true);
            expect(MESSAGE_TYPES.URL_CHANGED).toBe('URL_CHANGED');
            expect(MESSAGE_TYPES.BLOCKED).toBe('BLOCKED');
            expect(MESSAGE_TYPES.GET_COUNTERS).toBe('GET_COUNTERS');
            expect(MESSAGE_TYPES.RESET_COUNTERS).toBe('RESET_COUNTERS');
            expect(MESSAGE_TYPES.FETCH_REMOTE_CONFIG).toBe('FETCH_REMOTE_CONFIG');
            expect(MESSAGE_TYPES.COUNTER_UPDATE).toBe('COUNTER_UPDATE');
            expect(MESSAGE_TYPES.MANUAL_SCAN).toBe('MANUAL_SCAN');
            expect(MESSAGE_TYPES.SETTINGS_CHANGED).toBe('SETTINGS_CHANGED');
        });
    });

    describe('createUrlChangedMessage', () => {
        it('creates URL_CHANGED message with url', () => {
            const msg = createUrlChangedMessage('https://linkedin.com/feed/');
            expect(msg).toEqual({
                type: MESSAGE_TYPES.URL_CHANGED,
                url: 'https://linkedin.com/feed/'
            });
        });
    });

    describe('createManualScanMessage', () => {
        it('creates MANUAL_SCAN message', () => {
            const msg = createManualScanMessage();
            expect(msg).toEqual({ type: MESSAGE_TYPES.MANUAL_SCAN });
        });
    });

    describe('createSettingsChangedMessage', () => {
        it('creates SETTINGS_CHANGED message with settings', () => {
            const msg = createSettingsChangedMessage({ enabled: true, logging: false });
            expect(msg.type).toBe(MESSAGE_TYPES.SETTINGS_CHANGED);
            expect(msg.enabled).toBe(true);
            expect(msg.logging).toBe(false);
        });
    });

    describe('createBlockedMessage', () => {
        it('creates BLOCKED message with defaults', () => {
            const msg = createBlockedMessage();
            expect(msg).toEqual({
                type: MESSAGE_TYPES.BLOCKED,
                promoted: 0,
                suggested: 0,
                scanned: 0,
            });
        });

        it('creates BLOCKED message with values', () => {
            const msg = createBlockedMessage({ promoted: 3, suggested: 2, scanned: 10 });
            expect(msg).toEqual({
                type: MESSAGE_TYPES.BLOCKED,
                promoted: 3,
                suggested: 2,
                scanned: 10,
            });
        });
    });

    describe('createCounterUpdateMessage', () => {
        it('creates COUNTER_UPDATE message with values', () => {
            const msg = createCounterUpdateMessage({ promoted: 10, suggested: 5, scanned: 100 });
            expect(msg).toEqual({
                type: MESSAGE_TYPES.COUNTER_UPDATE,
                promoted: 10,
                suggested: 5,
                scanned: 100,
            });
        });
    });

    describe('createResetCountersMessage', () => {
        it('creates RESET_COUNTERS message', () => {
            const msg = createResetCountersMessage();
            expect(msg).toEqual({ type: MESSAGE_TYPES.RESET_COUNTERS });
        });
    });

    describe('createFetchRemoteConfigMessage', () => {
        it('creates FETCH_REMOTE_CONFIG message', () => {
            const msg = createFetchRemoteConfigMessage();
            expect(msg).toEqual({ type: MESSAGE_TYPES.FETCH_REMOTE_CONFIG });
        });
    });
});
