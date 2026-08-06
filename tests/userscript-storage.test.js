import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserscriptStorage } from '../src/userscript/storage.js';

describe('createUserscriptStorage', () => {
    let storage;

    beforeEach(() => {
        localStorage.clear();
        storage = createUserscriptStorage(localStorage);
    });

    describe('getBoolean', () => {
        it('returns the default fallback when the key is missing', () => {
            expect(storage.getBoolean('hideFloatingUI')).toBe(false);
        });

        it('returns true when the stored value is boolean true', () => {
            localStorage.setItem('lsb_hideFloatingUI', 'true');
            expect(storage.getBoolean('hideFloatingUI', false)).toBe(true);
        });

        it('returns false when the stored value is boolean false', () => {
            localStorage.setItem('lsb_hideFloatingUI', 'false');
            expect(storage.getBoolean('hideFloatingUI', true)).toBe(false);
        });

        it('returns the fallback for malformed JSON', () => {
            localStorage.setItem('lsb_hideFloatingUI', '{not json');
            expect(storage.getBoolean('hideFloatingUI', false)).toBe(false);
        });

        it.each([
            ['string "false"', '"false"'],
            ['number 1', '1'],
            ['object {}', '{}'],
            ['array []', '[]'],
            ['null', 'null'],
        ])('returns the fallback for wrong type %s', (_name, raw) => {
            localStorage.setItem('lsb_hideFloatingUI', raw);
            expect(storage.getBoolean('hideFloatingUI', false)).toBe(false);
        });
    });

    describe('set', () => {
        it('serializes a boolean to the exact lsb_ prefixed key', () => {
            storage.set('hideFloatingUI', true);
            expect(localStorage.getItem('lsb_hideFloatingUI')).toBe('true');
        });
    });

    describe('get/set', () => {
        it('prefixes keys with lsb_ and round-trips values', () => {
            storage.set('foo', { a: 1 });
            expect(localStorage.getItem('lsb_foo')).toBe('{"a":1}');
            expect(storage.get('foo')).toEqual({ a: 1 });
        });

        it('returns the fallback for a missing key', () => {
            expect(storage.get('missing', 'fallback')).toBe('fallback');
        });
    });

    describe('storage errors', () => {
        it('returns the fallback and reports get errors via onError', () => {
            const onError = vi.fn();
            const throwingStorage = {
                getItem() {
                    throw new Error('storage boom');
                },
                setItem() {},
            };
            const s = createUserscriptStorage(throwingStorage, onError);
            expect(s.get('key', 'fallback')).toBe('fallback');
            expect(onError).toHaveBeenCalledWith('get', 'key', expect.any(Error));
        });

        it('swallows set errors and reports them via onError', () => {
            const onError = vi.fn();
            const throwingStorage = {
                getItem() {
                    return null;
                },
                setItem() {
                    throw new Error('storage boom');
                },
            };
            const s = createUserscriptStorage(throwingStorage, onError);
            expect(() => s.set('key', 1)).not.toThrow();
            expect(onError).toHaveBeenCalledWith('set', 'key', expect.any(Error));
        });

        it('does not call onError for successful operations', () => {
            const onError = vi.fn();
            const s = createUserscriptStorage(localStorage, onError);
            s.set('key', 1);
            s.get('key');
            expect(onError).not.toHaveBeenCalled();
        });
    });
});
