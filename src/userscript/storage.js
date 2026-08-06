/**
 * Side-effect-free userscript localStorage adapter.
 *
 * All keys are namespaced with the STORAGE_PREFIX. Values are JSON-encoded
 * on write and JSON-decoded on read. Failures are reported to an optional
 * onError callback instead of throwing, so callers can degrade gracefully.
 */

export const STORAGE_PREFIX = 'lsb_';

export function createUserscriptStorage(storage, onError = () => {}) {
    function get(key, fallback) {
        try {
            const raw = storage.getItem(STORAGE_PREFIX + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch (error) {
            onError('get', key, error);
            return fallback;
        }
    }

    function getBoolean(key, fallback = false) {
        const value = get(key, fallback);
        return typeof value === 'boolean' ? value : fallback;
    }

    function set(key, value) {
        try {
            storage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        } catch (error) {
            onError('set', key, error);
        }
    }

    return { get, getBoolean, set };
}
