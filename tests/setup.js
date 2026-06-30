/**
 * Test setup: polyfills browser APIs not available in jsdom.
 */

// requestIdleCallback / cancelIdleCallback
if (typeof globalThis.requestIdleCallback === 'undefined') {
    globalThis.requestIdleCallback = (cb, options) =>
        setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), options?.timeout ?? 0);
}
if (typeof globalThis.cancelIdleCallback === 'undefined') {
    globalThis.cancelIdleCallback = (id) => clearTimeout(id);
}
